import { Injectable } from "@nestjs/common";
import { prisma, requireTenantId } from "@pawlog/database";
import { SALE_METHODS } from "@pawlog/shared";

/**
 * 유치원 매출 (job-051).
 *
 * ## 인식 기준: 입금 기준(현금주의)
 *
 * 10회권 20만원을 3월에 팔면 **3월 매출 20만원**이고, 4월에 다 쓰더라도 4월 매출은 0이다.
 * 원장이 통장을 보는 방식과 같아서 설명이 필요 없다는 게 이 선택의 이유다.
 *
 * 이용 기준(발생주의)으로 보고 싶어지면 이 서비스를 고치는 게 아니라, `SubscriptionLedger`
 * 의 USE 로우에 단가를 곱하는 별도 경로를 만드는 편이 맞다 — 두 관점은 서로를 대체하지
 * 않고, 원장은 보통 둘 다 궁금해한다.
 *
 * ## 무엇이 매출에 들어가지 않는가
 *
 * 원장이 pawlog 에 내는 **매장 개설권 비용은 여기 없다.** 그건 `UserSubscription`(회원이
 * 플랫폼에 내는 SaaS 요금)이고 유치원의 매출이 아니라 비용이다. 두 요금을 한 화면에서
 * 섞어 보면 "우리가 번 돈"이 얼마인지 알 수 없게 된다.
 *
 * 취소(환불)된 판매도 빠진다 — `canceledAt` 이 채워진 로우는 모든 집계에서 제외한다.
 */
@Injectable()
export class RevenueService {
  /**
   * 최근 N개월 매출 추이.
   *
   * 월 경계를 SQL 이 아니라 JS 에서 만드는 이유: `date_trunc` 는 DB 세션 타임존을 따르는데
   * 컨테이너는 UTC 다. 그대로 쓰면 매달 1일 오전 9시 이전의 판매가 **전달 매출로** 잡힌다
   * (KST 는 UTC+9). 유치원은 아침에 결제를 많이 받는 업종이라 이 오차가 작지 않다.
   */
  async monthly(months = 6) {
    const tenantId = requireTenantId();
    const buckets = buildMonthBuckets(months);

    const sales = await prisma.tenantSale.findMany({
      where: {
        tenantId,
        soldAt: {
          gte: buckets[0].start,
          lt: buckets[buckets.length - 1].end,
        },
      },
      select: {
        amount: true,
        refundedAmount: true,
        soldAt: true,
        method: true,
      },
    });

    return {
      months: buckets.map((bucket) => {
        const rows = sales.filter(
          (s) => s.soldAt >= bucket.start && s.soldAt < bucket.end,
        );
        // 전액 환불된 건은 순매출 0 으로 자연히 빠지지만 **건수에는 남긴다** —
        // "몇 건 팔았고 그중 얼마를 돌려줬나"가 보여야 한다.
        return {
          year: bucket.year,
          month: bucket.month,
          label: `${bucket.year}-${String(bucket.month).padStart(2, "0")}`,
          total: sum(rows.map(netAmount)),
          count: rows.length,
          refunded: sum(rows.map((r) => r.refundedAmount)),
        };
      }),
    };
  }

  /**
   * 특정 월 상세 — 결제수단별 / 요금제별 분해 + 건별 목록.
   *
   * 결제수단별을 첫 화면에 두는 이유: 현금·계좌이체는 원장이 직접 입력한 값이라
   * 카드와 달리 대사할 근거가 없다. 그 비중이 보여야 장부를 얼마나 믿을지 판단할 수 있다.
   */
  /**
   * 그 달의 **날짜별** 매출 (job-063) — 매출 화면의 달력이 쓴다.
   *
   * ## 왜 `summary` 의 건별 목록으로 화면에서 접지 않는가
   *
   * `summary.sales` 는 `soldAt` 이 UTC ISO 로 나가므로, 화면이 그걸 날짜로 접으면 **KST
   * 09시 이전 판매가 전날로 붙는다.** 아침에 결제를 많이 받는 업종이라 그 오차가 작지
   * 않고, 같은 화면의 월 합계(`monthly`)와 어긋나 원장이 숫자를 못 믿게 된다.
   * 날짜 경계는 이미 이 서비스가 KST 로 다루고 있으므로 여기서 접어 내려보낸다.
   *
   * ## 세 숫자를 다 내려보내는 이유
   *
   * 순매출만 주면 "그날 0원"이 **판매가 없었다**인지 **팔고 전액 환불했다**인지 구분되지
   * 않는다. 원장에게 그 둘은 완전히 다른 하루다.
   */
  async daily(year: number, month: number) {
    const tenantId = requireTenantId();
    const start = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
    const end = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);

    const sales = await prisma.tenantSale.findMany({
      where: { tenantId, soldAt: { gte: start, lt: end } },
      select: { amount: true, refundedAmount: true, soldAt: true },
    });

    const byDate = new Map<
      string,
      { gross: number; refunded: number; count: number }
    >();

    for (const sale of sales) {
      // UTC 시각에 +9h 를 더한 뒤 UTC 달력으로 읽으면 그것이 곧 한국 달력 날짜다.
      const date = new Date(sale.soldAt.getTime() + KST_OFFSET_MS)
        .toISOString()
        .slice(0, 10);
      const row = byDate.get(date) ?? { gross: 0, refunded: 0, count: 0 };
      row.gross += sale.amount;
      row.refunded += sale.refundedAmount;
      row.count += 1;
      byDate.set(date, row);
    }

    return {
      year,
      month,
      // 판매가 있는 날만 담는다 — 빈 날까지 채워 보내면 한 달치가 통째로 커지는데,
      // 화면은 어차피 없는 날을 빈 칸으로 그린다.
      days: [...byDate.entries()]
        .map(([date, row]) => ({
          date,
          gross: row.gross,
          refunded: row.refunded,
          total: row.gross - row.refunded,
          count: row.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async summary(year: number, month: number) {
    const tenantId = requireTenantId();
    const start = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
    const end = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);

    const sales = await prisma.tenantSale.findMany({
      where: { tenantId, soldAt: { gte: start, lt: end } },
      include: {
        plan: { select: { id: true, name: true, planType: true } },
        pet: { select: { id: true, name: true } },
      },
      orderBy: { soldAt: "desc" },
    });

    const byMethod = SALE_METHODS.map((method) => {
      const rows = sales.filter((s) => s.method === method);
      return {
        method: method,
        total: sum(rows.map(netAmount)),
        count: rows.length,
      };
    }).filter((row) => row.count > 0);

    // 요금제가 삭제되면 planId 가 null 이 된다(매출 기록은 남긴다) — 그 몫을 버리지 않고
    // "삭제된 요금제"로 묶는다. 합계가 건별 목록과 어긋나면 원장은 화면 전체를 못 믿는다.
    const planIds = [...new Set(sales.map((s) => s.plan?.id ?? null))];
    const byPlan = planIds
      .map((planId) => {
        const rows = sales.filter((s) => (s.plan?.id ?? null) === planId);
        return {
          planId,
          planName: rows[0]?.plan?.name ?? "삭제된 요금제",
          total: sum(rows.map(netAmount)),
          count: rows.length,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      year,
      month,
      /** 순매출 — 환불을 뺀 실제로 남은 돈. 원장이 "이번 달 얼마 벌었나"에서 기대하는 숫자다. */
      total: sum(sales.map(netAmount)),
      count: sales.length,
      /** 총 환불액. 순매출만 보여주면 매출이 준 이유가 판매 부진인지 환불인지 알 수 없다. */
      refunded: sum(sales.map((s) => s.refundedAmount)),
      byMethod,
      byPlan,
      sales: sales.map((s) => ({
        id: s.id,
        amount: s.amount,
        refundedAmount: s.refundedAmount,
        refundReason: s.refundReason,
        method: s.method,
        soldAt: s.soldAt,
        memo: s.memo,
        planName: s.plan?.name ?? null,
        petName: s.pet?.name ?? null,
      })),
    };
  }
}

/** 순매출 = 받은 돈 − 돌려준 돈. 전액 환불이면 0 이 되어 집계에서 자연히 빠진다. */
const netAmount = (sale: { amount: number; refundedAmount: number }) =>
  sale.amount - sale.refundedAmount;

/** KST 는 UTC+9. Date 는 UTC 기준이라 월 경계를 만들 때 이만큼 되돌려야 한국의 1일 00:00 이 된다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

/** 이번 달을 마지막으로 하는 최근 N개월 구간(한국 시간 기준 월 경계). */
function buildMonthBuckets(months: number) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const baseYear = kstNow.getUTCFullYear();
  const baseMonth = kstNow.getUTCMonth(); // 0-indexed

  return Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const year = baseYear;
    const month = baseMonth - offset;
    return {
      year: new Date(Date.UTC(year, month, 1)).getUTCFullYear(),
      month: new Date(Date.UTC(year, month, 1)).getUTCMonth() + 1,
      start: new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS),
      end: new Date(Date.UTC(year, month + 1, 1) - KST_OFFSET_MS),
    };
  });
}
