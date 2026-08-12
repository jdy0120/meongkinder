import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  requireTenantId,
  runWithoutTenant,
  tenantTransaction,
} from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { REMAINING_COUNT_LOW_THRESHOLD } from "../../notification/constants";
import { NotificationService } from "../../notification/services/notification.service";
import { resolveGuardianPhone } from "../../shared/utils";
import {
  ChargeLedgerDto,
  CreateSubscriptionLedgerDto,
  RefundSaleDto,
  SellTicketDto,
  UpdateSubscriptionLedgerDto,
} from "../dtos";

@Injectable()
export class SubscriptionLedgerService {
  private readonly logger = new Logger(SubscriptionLedgerService.name);

  constructor(private readonly notificationService: NotificationService) {}
  /**
   * 이 아이의 현재 잔여 횟수 (job-045).
   *
   * 원장은 append-only 라서 "마지막 한 줄의 balanceAfter" 가 곧 현재 잔액이다.
   * 합계를 매번 다시 더하지 않는 이유는 환불·소멸 보정이 섞여도 그 줄이 진실이기 때문이다.
   */
  async balanceOf(petId: string): Promise<number> {
    const last = await prisma.subscriptionLedger.findFirst({
      where: { petId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    return last?.balanceAfter ?? 0;
  }

  /**
   * 원장 한 줄 추가 — **잔액은 서버가 계산한다** (job-045).
   *
   * 예전에는 호출부가 `balanceAfter` 를 직접 넣었다. 그러면 두 요청이 같은 잔액을 읽고 각자
   * 계산해 넣는 순간 하나가 덮여 사라진다(회수권이 공짜가 되거나 두 번 차감된다). 돈이 걸린
   * 값이라 계산 위치를 한 곳으로 모은다.
   *
   * `SELECT ... FOR UPDATE` 가 아니라 트랜잭션 안에서 읽고 쓰는 이유: 원장은 append-only 라
   * 잠글 기존 행이 없다. 동시성은 출석 1건당 원장 1건을 보장하는 `attendanceId` 유니크가
   * 실질적으로 막고, 수기 충전은 사람이 누르는 속도라 경합이 없다.
   */
  private async append(params: {
    petId: string;
    userId?: string | null;
    type: string;
    amount: number;
    subscriptionId?: string | null;
    attendanceId?: string | null;
    description?: string | null;
  }) {
    return tenantTransaction(prisma, async (tx) => {
      const last = await tx.subscriptionLedger.findFirst({
        where: { petId: params.petId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      const balanceAfter = (last?.balanceAfter ?? 0) + params.amount;

      return tx.subscriptionLedger.create({
        data: {
          tenantId: requireTenantId(),
          petId: params.petId,
          userId: params.userId ?? null,
          subscriptionId: params.subscriptionId ?? null,
          attendanceId: params.attendanceId ?? null,
          type: params.type,
          amount: params.amount,
          balanceAfter,
          description: params.description ?? null,
        },
      });
    });
  }

  /**
   * 현장 판매 — 원장이 대면으로 결제받고 이용권을 개통한다 (job-045 → job-051).
   *
   * ## 무엇이 바뀌었나
   *
   * 예전에는 **횟수만** 받았다(`petId` + `amount`). 원장이 현금 20만원을 받아 10회를
   * 넣어도 DB 에는 "10회"만 남아서, 동네 유치원 매출의 큰 몫인 현금·계좌이체가 통째로
   * 집계에서 빠졌다. 그리고 어떤 상품을 판 것인지도 남지 않아 "어떤 이용권이 잘 팔리나"를
   * 볼 수 없었다.
   *
   * 이제 **요금제를 골라 판다.** 횟수·유효기간·금액이 요금제에서 따라오고, 원장은
   * 결제수단만 고른다. 결과적으로 카드 결제(`subscribe`)와 같은 것들이 만들어진다 —
   * 이용권(TenantSubscription) · 잔액(SubscriptionLedger) · 매출(TenantSale).
   * 두 경로가 같은 모양을 남겨야 매출 집계가 결제수단에 따라 갈라지지 않는다.
   *
   * `amount`(실수령액)는 선택이다. 형제 할인처럼 정가와 다르게 받는 경우가 실제로 있고,
   * **매출은 받은 돈 기준**이라 정가를 강제로 기록하면 장부가 틀린다. 비우면 정가로 잡는다.
   */
  async sell(dto: SellTicketDto) {
    const tenantId = requireTenantId();
    const pet = await this.findPetInTenant(dto.petId);

    // 다른 유치원의 요금제로는 팔 수 없다 (job-051).
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: dto.planId, scope: "TENANT", tenantId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException("판매 중인 요금제가 아닙니다.");
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (plan.validityDays ?? 30));

    // 이용권 · 잔액 · 매출은 한 거래다 — 하나라도 빠지면 장부가 어긋나므로 한 트랜잭션에 묶는다.
    return prisma.$transaction(async (tx) => {
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          petId: pet.id,
          status: "ACTIVE",
          startDate,
          endDate,
          nextPaymentDate: endDate,
        },
      });

      const sale = await tx.tenantSale.create({
        data: {
          tenantId,
          planId: plan.id,
          petId: pet.id,
          subscriptionId: subscription.id,
          amount: dto.amount ?? plan.price,
          method: dto.method,
          soldAt: startDate,
          memo: dto.memo,
        },
      });

      // 횟수제만 잔액이 늘어난다. 기간제(무제한)는 잔액 개념이 없고, 출석 차감이
      // 이 아이의 활성 기간권을 보고 0회로 기록한다.
      let ledger = null;
      if (
        (plan.planType === "COUNT" || plan.planType === "PERIOD") &&
        plan.totalCount
      ) {
        const last = await tx.subscriptionLedger.findFirst({
          where: { petId: pet.id },
          orderBy: { createdAt: "desc" },
          select: { balanceAfter: true },
        });
        ledger = await tx.subscriptionLedger.create({
          data: {
            tenantId,
            petId: pet.id,
            userId: pet.userId,
            subscriptionId: subscription.id,
            type: "CHARGE",
            amount: plan.totalCount,
            balanceAfter: (last?.balanceAfter ?? 0) + plan.totalCount,
            description: `${plan.name} 현장 판매`,
          },
        });
      }

      return {
        subscription,
        sale,
        ledger,
        balance: ledger?.balanceAfter ?? null,
      };
    });
  }

  /**
   * 판매 환불 (job-054).
   *
   * ## 무엇을 되돌리는가
   *
   * 환불은 **돈과 이용권 둘 다**를 되돌려야 한다. 금액만 지우면 회수권 10회가 그대로 남아
   * 환불받은 아이가 계속 등원한다. 그래서 한 트랜잭션에서 셋을 함께 처리한다:
   *   ① 매출  — `refundedAmount` 를 채운다(전액/부분)
   *   ② 이용권 — 연결된 구독을 CANCELED 로 내린다
   *   ③ 잔액  — **남은 횟수만** REFUND 로우로 회수한다
   *
   * ③ 이 "남은 횟수만"인 게 핵심이다. 10회권을 팔고 3회 썼으면 회수 대상은 7회다.
   * 이미 제공한 3회를 회수하면 잔액이 음수가 되어 다른 이용권까지 갉아먹는다.
   * 그 판매분의 잔량은 `SUM(ledger.amount WHERE subscriptionId)` 로 정확히 나온다 —
   * 충전(+10)과 그 구독으로 차감된 사용(-1씩)이 같은 `subscriptionId` 를 달고 있기 때문이다.
   *
   * ## PG 취소는 하지 않는다
   *
   * 카드 결제였더라도 **토스 취소를 자동으로 부르지 않는다.** 실제 돈이 움직이는 비가역
   * 작업인데, 토스 취소가 실패했는데 장부만 환불된 상태가 더 나쁘기 때문이다. 카드 건은
   * 응답의 `paymentKey` 로 원장이 `POST v1/payments/:paymentKey/cancel` 을 따로 실행한다.
   */
  async refundSale(saleId: string, dto: RefundSaleDto) {
    const tenantId = requireTenantId();

    const sale = await prisma.tenantSale.findFirst({
      where: { id: saleId, tenantId },
      include: { payment: { select: { paymentKey: true } } },
    });
    if (!sale) {
      throw new NotFoundException("존재하지 않는 판매 기록입니다.");
    }

    const refundable = sale.amount - sale.refundedAmount;
    if (refundable <= 0) {
      throw new BadRequestException("이미 전액 환불된 판매입니다.");
    }

    // 금액을 안 주면 남은 전액을 환불한다 — 대부분은 전액 환불이라 기본값이 그쪽이어야 한다.
    const refundAmount = dto.amount ?? refundable;
    if (refundAmount <= 0 || refundAmount > refundable) {
      throw new BadRequestException(
        `환불 금액은 1원 이상 ${refundable}원 이하여야 합니다.`,
      );
    }

    const isFullRefund = sale.refundedAmount + refundAmount >= sale.amount;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tenantSale.update({
        where: { id: sale.id },
        data: {
          refundedAmount: sale.refundedAmount + refundAmount,
          refundReason: dto.reason ?? sale.refundReason,
          canceledAt: new Date(),
        },
      });

      // 부분 환불이면 이용권은 살려둔다 — 일부만 돌려주고 계속 다니는 경우가 있다.
      // 이용권까지 회수할지는 전액 환불일 때만 자동으로 판단한다.
      let revokedCount = 0;
      if (isFullRefund && sale.subscriptionId) {
        const remaining = await tx.subscriptionLedger.aggregate({
          where: { subscriptionId: sale.subscriptionId },
          _sum: { amount: true },
        });
        revokedCount = Math.max(0, remaining._sum.amount ?? 0);

        if (revokedCount > 0 && sale.petId) {
          const last = await tx.subscriptionLedger.findFirst({
            where: { petId: sale.petId },
            orderBy: { createdAt: "desc" },
            select: { balanceAfter: true },
          });
          await tx.subscriptionLedger.create({
            data: {
              tenantId,
              petId: sale.petId,
              subscriptionId: sale.subscriptionId,
              type: "REFUND",
              amount: -revokedCount,
              balanceAfter: (last?.balanceAfter ?? 0) - revokedCount,
              description: `환불에 따른 잔여 ${revokedCount}회 회수`,
            },
          });
        }

        await tx.tenantSubscription.update({
          where: { id: sale.subscriptionId },
          data: { status: "CANCELED" },
        });
      }

      return {
        sale: updated,
        refundAmount,
        isFullRefund,
        revokedCount,
        // 카드 결제였다면 PG 취소를 따로 해야 한다는 신호. null 이면 현장 수납이라 할 일이 없다.
        paymentKey: sale.payment?.paymentKey ?? null,
      };
    });
  }

  /**
   * 이용권 횟수 수동 보정 — 판매가 아니라 **조정**이다 (job-045).
   *
   * 서비스 보상으로 1회 얹어주거나 시스템 오류를 되돌리는 용도라 매출을 만들지 않는다.
   * 돈을 받고 파는 것은 위의 `sell` 이다 — 이 둘을 한 함수로 합치면 "매출 없는 충전"과
   * "매출 있는 판매"가 섞여 장부가 조용히 틀어진다.
   */
  async charge(dto: ChargeLedgerDto) {
    const pet = await this.findPetInTenant(dto.petId);
    const ledger = await this.append({
      petId: pet.id,
      userId: pet.userId,
      type: "CHARGE",
      amount: dto.amount,
      description: dto.description ?? `이용권 ${dto.amount}회 보정`,
    });
    return { ledger, balance: ledger.balanceAfter };
  }

  /** 정기권/회수권 변동 내역 생성 (수동 보정용) */
  async create(dto: CreateSubscriptionLedgerDto) {
    await this.findPetInTenant(dto.petId);
    const ledger = await this.append({
      petId: dto.petId,
      userId: dto.userId,
      subscriptionId: dto.subscriptionId,
      attendanceId: dto.attendanceId,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
    });
    return { ledger };
  }

  /** 이 매장의 원생인지 확인 — 남의 매장 아이에 충전/보정하지 못하게 한다. */
  private async findPetInTenant(petId: string) {
    const pet = await prisma.pet.findFirst({
      where: { id: petId, tenantId: requireTenantId() },
      select: { id: true, userId: true, name: true },
    });
    if (!pet) {
      throw new NotFoundException("이 매장의 원생이 아닙니다.");
    }
    return pet;
  }

  /** 변동 내역 목록 (petId/userId 필터 + 페이지네이션) */
  async findAll(query: PaginationQuery & { userId?: string; petId?: string }) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const where = {
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.subscriptionLedger.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
      });
      const total = await tx.subscriptionLedger.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 보호자 - 내 아이들의 이용권 잔액 + 최근 사용 내역 (job-045).
   *
   * 잔액이 **아이 단위**이므로 회원 기준 목록 하나로는 답이 안 된다("우리 초코 몇 번 남았지"를
   * 못 본다). 아이별로 잔액을 얹어 돌려준다. 계정이 연결된 아이만 대상이다.
   */
  async findMineByPet(userId: string) {
    const pets = await runWithoutTenant(() =>
      prisma.pet.findMany({
        where: { userId, tenantId: { not: null } },
        select: { id: true, name: true, tenantId: true },
        orderBy: { createdAt: "asc" },
      }),
    );

    return {
      pets: await Promise.all(
        pets.map(async (pet) => ({
          petId: pet.id,
          petName: pet.name,
          balance: await this.balanceOf(pet.id),
          recent: await runWithoutTenant(() =>
            prisma.subscriptionLedger.findMany({
              where: { petId: pet.id },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ),
        })),
      ),
    };
  }

  /** 변동 내역 상세 조회 */
  async findOne(id: string) {
    const ledger = await prisma.subscriptionLedger.findUnique({
      where: { id },
    });
    if (!ledger) {
      throw new NotFoundException("존재하지 않는 정기권/회수권 내역입니다.");
    }
    return { ledger };
  }

  /** 변동 내역 수정 (수동 보정용) */
  async update(id: string, dto: UpdateSubscriptionLedgerDto) {
    await this.findOne(id);

    const ledger = await prisma.subscriptionLedger.update({
      where: { id },
      data: {
        subscriptionId: dto.subscriptionId,
        attendanceId: dto.attendanceId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
      },
    });
    return { ledger };
  }

  /** 변동 내역 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.subscriptionLedger.delete({ where: { id } });
    return { id };
  }

  /**
   * 출석 처리에 따른 이용권 차감 (job-045: 아이 단위).
   *
   * ## 계정이 없어도 차감한다
   *
   * 예전에는 회원 기준이라 계정 없는 원생은 통째로 건너뛰었다 — 그런데 매장이 도입하는
   * 첫날엔 원생 전원이 그 상태라, **회수권을 파는 매장이 회수권을 한 번도 차감하지 못했다.**
   * 이제 원장이 아이에 달려 있어 가입 여부와 무관하게 돈이 맞는다.
   *
   * ## 잔액이 없으면 차감하지 않는다
   *
   * 예전에는 0에서 시작해 -1, -2 … 로 끝없이 내려갔다(충전 경로가 아예 없었다). 음수 잔액은
   * 어느 쪽에도 쓸모가 없다 — 매장은 못 받은 돈을 모르고, 보호자는 "-3회"를 본다. 그래서
   * **차감을 멈추고 그 사실을 남긴다**(출석 자체는 막지 않는다. 아이는 이미 와 있다).
   *
   * `attendanceId` 가 유니크라 같은 출석은 두 번 차감되지 않는다.
   */
  async deductForAttendance(params: {
    petId: string;
    userId?: string | null;
    attendanceId: string;
    description?: string;
  }) {
    const existing = await prisma.subscriptionLedger.findUnique({
      where: { attendanceId: params.attendanceId },
    });
    if (existing) {
      return existing;
    }

    // job-051: **그 아이의** 활성 이용권을 찾는다.
    //
    // 예전에는 `where: { status: "ACTIVE" }` 로 그 매장의 가장 최근 구독 1건을 집어
    // 전체 원생의 차감 규칙을 정했다. 일권과 한달권을 같이 파는 순간 둘 중 하나는 반드시
    // 틀렸다 — 최근 구독이 한달권이면 일권 아이도 "무제한 이용"으로 기록돼 **공짜로 다니고**,
    // 일권이면 한달권 아이가 -1씩 깎이다 잔액 0에서 "잔여 없음" 알림까지 받았다.
    // 출석 처리마다 조용히 일어나서 월말 정산 전에는 아무도 몰랐다.
    //
    const activeSubscriptions = await prisma.tenantSubscription.findMany({
      where: {
        petId: params.petId,
        status: "ACTIVE",
        endDate: { gte: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    // 한 아이가 한달권과 회수권을 함께 갖고 있으면 **기간권이 우선**이다 — 회수권은 그
    // 기간이 끝난 뒤를 위해 남겨두는 것이 상식적인 순서고, 반대로 하면 무제한 기간에도
    // 회수권이 깎여 보호자가 손해를 본다. 우선순위를 orderBy 로 표현하지 않는 이유는
    // planType 알파벳순(COUNT < PERIOD < RECURRING < UNLIMITED)이 이 의도와 무관해서다.
    const activeSubscription =
      activeSubscriptions.find(
        (s) =>
          s.plan.planType === "UNLIMITED" || s.plan.planType === "RECURRING",
      ) ?? activeSubscriptions[0];

    // 무제한/정기결제형은 횟수 개념이 없다 — 이용 기록만 0회로 남긴다.
    const planType = activeSubscription?.plan.planType;
    if (
      activeSubscription &&
      (planType === "RECURRING" || planType === "UNLIMITED")
    ) {
      return this.append({
        petId: params.petId,
        userId: params.userId,
        subscriptionId: activeSubscription.id,
        attendanceId: params.attendanceId,
        type: "USE",
        amount: 0,
        description: "무제한 요금제 이용 (잔여 횟수 차감 없음)",
      });
    }

    const balance = await this.balanceOf(params.petId);
    if (balance <= 0) {
      this.logger.warn(
        `잔여 이용권이 없어 차감하지 않았습니다. petId=${params.petId} ` +
          `attendanceId=${params.attendanceId} balance=${balance} — 충전이 필요합니다.`,
      );
      return this.append({
        petId: params.petId,
        userId: params.userId,
        subscriptionId: activeSubscription?.id,
        attendanceId: params.attendanceId,
        type: "USE",
        amount: 0,
        description: "잔여 이용권 없음 — 차감하지 않음 (충전 필요)",
      });
    }

    const ledger = await this.append({
      petId: params.petId,
      userId: params.userId,
      subscriptionId: activeSubscription?.id,
      attendanceId: params.attendanceId,
      type: "USE",
      amount: -1,
      description: params.description ?? "출석 처리에 따른 이용권 차감",
    });

    if (ledger.balanceAfter <= REMAINING_COUNT_LOW_THRESHOLD) {
      await this.notifyRemainingCountLow(params.petId, ledger.balanceAfter);
    }

    return ledger;
  }

  /**
   * 등원 되돌리기에 따른 차감 취소 (job-052).
   *
   * ## 왜 필요한가
   *
   * 디자인 규칙(design-system.md §3.2)은 상태 변경에 8초 되돌리기를 요구한다. 그런데
   * 등원 체크는 화면 상태만 바꾸는 게 아니라 **회수권을 1회 깎는다.** 화면만 되돌리면
   * 오터치 한 번에 보호자가 조용히 1회를 잃고, 그건 월말에 클레임으로 돌아온다.
   *
   * ## 왜 원장(ledger) 행을 지우지 않는가
   *
   * 원장은 append-only 다. 중간 행을 지우면 뒤따르는 행들의 `balanceAfter` 체인이 전부
   * 틀어진다(그 값이 곧 잔액이라 잔액이 통째로 깨진다). 그래서 **반대 부호의 보정 행을
   * 하나 더 쌓는다** — 회계에서 오기입을 지우지 않고 역분개하는 것과 같다.
   *
   * ## 원본 행의 attendanceId 를 떼는 이유
   *
   * `SubscriptionLedger.attendanceId` 는 유니크이고, `deductForAttendance` 는 그 값으로
   * "이미 차감했는가"를 판정한다. 링크를 남겨 두면 **되돌린 뒤 다시 등원 체크했을 때
   * 차감이 통째로 건너뛰어져 그날은 공짜가 된다.** 원본이 어느 출석의 것이었는지는
   * description 에 남는다.
   */
  async revertForAttendance(attendanceId: string) {
    const original = await prisma.subscriptionLedger.findUnique({
      where: { attendanceId },
    });

    // 차감 기록이 없으면 되돌릴 것도 없다 — 계정 미연결 원생이나 이용권을 판 적 없는
    // 아이는 애초에 차감되지 않았다(그 경우가 정상이다).
    if (!original) return null;

    return tenantTransaction(prisma, async (tx) => {
      await tx.subscriptionLedger.update({
        where: { id: original.id },
        data: {
          attendanceId: null,
          description: `${original.description ?? "출석 차감"} (되돌림 · attendance=${attendanceId})`,
        },
      });

      // amount 가 0 인 행(무제한 요금제·잔액 부족)은 보정할 잔액이 없다. 원본의 링크만
      // 떼어 두면 재체크 시 정상 경로를 다시 탄다.
      if (original.amount === 0) return null;

      const last = await tx.subscriptionLedger.findFirst({
        where: { petId: original.petId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });

      return tx.subscriptionLedger.create({
        data: {
          tenantId: requireTenantId(),
          petId: original.petId,
          userId: original.userId,
          subscriptionId: original.subscriptionId,
          type: "REFUND",
          amount: -original.amount,
          balanceAfter: (last?.balanceAfter ?? 0) - original.amount,
          description: `등원 되돌리기에 따른 차감 취소 (attendance=${attendanceId})`,
        },
      });
    });
  }

  /**
   * 잔여횟수 임박 알림 (job-045: 아이 단위).
   * 아이의 연락처로 보낸다 — 계정이 없어도 알림톡은 번호로 나간다.
   */
  private async notifyRemainingCountLow(petId: string, remaining: number) {
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: {
        name: true,
        userId: true,
        guardianPhone: true,
        user: { select: { phone: true } },
      },
    });
    if (!pet) return;

    await this.notificationService.notifyRemainingCountLow({
      userId: pet.userId,
      petName: pet.name,
      guardianPhone: resolveGuardianPhone(pet),
      remaining,
    });
  }
}
