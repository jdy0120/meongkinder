import { BadRequestException, Injectable } from "@nestjs/common";
import { getTenantId, prisma, tenantTransaction } from "@pawlog/database";
import {
  BADGE_LEVEL,
  MEMBERSHIP_STATUS,
  parseVaccinations,
  resolveAdaptationDay,
  resolvePetSafetyLevel,
  resolveVaccination,
  ROLES,
  VACCINATION_STATUS,
  VACCINATION_TYPE_LABEL,
  type DashboardAttentionReason,
} from "@pawlog/shared";

import { startOfToday } from "../../shared/utils";

/** 이 잔여 횟수 이하면 하원 때 보호자에게 말해야 한다 (design-system.md §6.2 5순위). */
const LOW_PASS_THRESHOLD = 2;

/**
 * 매장 대시보드 (job-052, design-system.md §6.2).
 *
 * ## 순서의 근거
 *
 * 블록 순서는 '중요도'가 아니라 **"지금 안 보면 되돌릴 수 없는 정도 × 오전에만 대응
 * 가능한 정도"** 로 정한다. 그래서 응답이 다섯 덩어리로 고정돼 있고, 화면은 순서를
 * 고르지 않는다 — 화면마다 다르게 배열하면 그 순간 이 근거가 사라진다.
 *
 *   1 오늘 등원 현황   미도착은 즉시 보호자 확인 전화로 이어져야 한다
 *   2 오늘 주의할 아이  사고 예방 정보라 사후 확인이 무의미하다
 *   3 훈련사 배치 비율  결원 시 **오전에만** 대체 인력을 구할 수 있다
 *   4 픽업 타임라인    오후 혼잡 구간을 오전에 미리 알아야 배치를 조정한다
 *   5 이용권 잔여      시간 민감도가 가장 낮다 (하원 때 말하면 된다)
 *
 * ## 예방접종 만료를 별도 블록으로 만들지 않는 이유
 *
 * "접종 만료 2건"을 보면 결국 그 아이가 오늘 오는지 확인하러 등원 목록으로 다시 들어가야
 * 한다. 접종 상태는 1순위 등원 목록 **안에서** critical 로 잡는 것이 동선이 짧다.
 * 정보를 카드 개수로 나열하는 것보다 실제 동선 위에 얹는 편이 인지 부하를 더 줄인다.
 */
@Injectable()
export class DashboardService {
  async getDashboard() {
    const today = startOfToday();
    // ⚠️ TenantMembership 은 `tenantScopeExtension` 의 자동 주입 대상이 **아니다**
    // ("내가 속한 매장 목록"을 테넌트 밖에서 조회해야 해서 일부러 빠져 있다).
    // 그래서 아래 count 의 tenantId 는 생략하면 안 된다 — 빠뜨리면 조용히
    // **전 매장 합계**가 나온다(실제로 한 매장에 훈련사 37명으로 표시됐다).
    //
    // 테넌트가 안 잡힌 요청(SUPER_ADMIN 이 X-Tenant-Id 없이 부르는 경우)은 여기서 멈춘다.
    // 그대로 두면 bypass 컨텍스트라 출석 조회까지 전 매장을 훑는다.
    const tenantId = getTenantId();
    if (!tenantId) {
      throw new BadRequestException(
        "매장이 지정되지 않았습니다. 매장을 선택한 뒤 다시 시도해주세요.",
      );
    }

    const [attendances, staffCount] = await tenantTransaction(prisma, (tx) =>
      Promise.all([
        tx.attendance.findMany({
          where: { date: today },
          include: {
            pet: {
              select: {
                id: true,
                name: true,
                allergies: true,
                temperaments: true,
                marksIndoors: true,
                mountingBehavior: true,
                hasBiteHistory: true,
                vaccinations: true,
                adaptationStartedAt: true,
                pickupTime: true,
                pickupMethod: true,
                shuttleNumber: true,
              },
            },
          },
        }),
        // 훈련사 = 이 매장에서 아이를 보는 사람. 원장도 현장에 서므로 함께 센다
        // (GUARDIAN 은 보호자라 제외). 단순 출근 인원이 아니라 **비율**로 보여야
        // 판단 기준이 된다 — "3명"은 많은 건지 적은 건지 알 수 없다.
        tx.tenantMembership.count({
          where: {
            tenantId,
            status: MEMBERSHIP_STATUS.ACTIVE,
            role: { in: [ROLES.STAFF, ROLES.TENANT_ADMIN] },
          },
        }),
      ]),
    );

    const attending = attendances.filter(
      (attendance) => attendance.status !== "CANCELED",
    );
    // 배치 비율에서만 결석을 뺀다. 1순위 블록은 결석한 아이의 **이름**을 보여줘야 하므로
    // `attending` 에 남겨두지만, "훈련사 1명이 오늘 몇 마리를 보는가"에 오늘 오지 않는
    // 아이가 섞이면 실제보다 나쁜 비율이 나오고 원장은 그 숫자를 무시하게 된다.
    const present = attending.filter(
      (attendance) => attendance.status !== "ABSENT",
    );

    return {
      attendance: this.buildAttendance(attending),
      attention: this.buildAttention(attending),
      staffing: {
        staffCount,
        // 오늘 오는 아이 기준이다. 전체 원생으로 나누면 안 오는 날 아이까지 세어
        // 실제보다 나쁜 비율이 나오고, 원장은 매일 그 숫자를 무시하게 된다.
        petCount: present.length,
        petsPerStaff:
          staffCount > 0
            ? Math.round((present.length / staffCount) * 10) / 10
            : null,
      },
      pickup: this.buildPickup(attending),
      passes: await this.buildPasses(attending.map(({ pet }) => pet.id)),
    };
  }

  /** 1순위 — 오늘 등원 현황. 미도착은 **이름까지** 준다(바로 전화해야 하므로). */
  private buildAttendance(attendances: TodayAttendance[]) {
    const byStatus = (status: string) =>
      attendances.filter((attendance) => attendance.status === status);

    return {
      checkedIn: byStatus("CHECKED_IN").length,
      checkedOut: byStatus("CHECKED_OUT").length,
      total: attendances.length,
      // "몇 마리 왔나"보다 "지금 누가 올 차례인가"가 실무 정보다.
      scheduled: byStatus("SCHEDULED").map(({ pet }) => ({
        id: pet.id,
        name: pet.name,
        pickupTime: pet.pickupTime,
      })),
      absent: byStatus("ABSENT").map(({ pet }) => ({
        id: pet.id,
        name: pet.name,
      })),
    };
  }

  /**
   * 2순위 — 오늘 주의할 아이. **오늘 오는 아이만** 본다.
   *
   * 전체 원생에서 뽑으면 오늘 안 오는 아이까지 섞여 목록이 길어지고, 길어지면 안 읽는다.
   * 1순위에서 등원 여부를 확인한 직후에 봐야 조회 맥락이 이어진다.
   */
  private buildAttention(attendances: TodayAttendance[]) {
    return (
      attendances
        .map(({ pet }) => {
          const reasons: DashboardAttentionReason[] = [];

          if (pet.hasBiteHistory) {
            reasons.push({ level: BADGE_LEVEL.CRITICAL, label: "공격 이력" });
          }

          for (const record of parseVaccinations(pet.vaccinations)) {
            const resolved = resolveVaccination(record);
            const name = VACCINATION_TYPE_LABEL[record.type] ?? record.type;

            if (resolved.status === VACCINATION_STATUS.EXPIRED) {
              reasons.push({
                level: BADGE_LEVEL.CRITICAL,
                label: `${name} 만료`,
              });
            } else if (resolved.status === VACCINATION_STATUS.EXPIRING_SOON) {
              reasons.push({
                level: BADGE_LEVEL.CAUTION,
                label: `${name} D-${resolved.daysLeft}`,
              });
            }
          }

          for (const allergy of pet.allergies) {
            reasons.push({
              level: BADGE_LEVEL.CAUTION,
              label: `${allergy} 알러지`,
            });
          }

          const adaptationDay = resolveAdaptationDay(pet.adaptationStartedAt);
          if (adaptationDay !== null) {
            reasons.push({
              level: BADGE_LEVEL.CAUTION,
              label: `적응 ${adaptationDay}일차`,
            });
          }

          for (const temperament of pet.temperaments) {
            reasons.push({ level: BADGE_LEVEL.CAUTION, label: temperament });
          }
          if (pet.marksIndoors) {
            reasons.push({ level: BADGE_LEVEL.CAUTION, label: "마킹" });
          }
          if (pet.mountingBehavior) {
            reasons.push({ level: BADGE_LEVEL.CAUTION, label: "마운팅" });
          }

          return {
            id: pet.id,
            name: pet.name,
            level: resolvePetSafetyLevel(pet),
            reasons,
          };
        })
        .filter((pet) => pet.reasons.length > 0)
        // critical 이 위로. 아래쪽은 잘려도 되지만 위쪽은 절대 잘리면 안 된다.
        .sort((a, b) =>
          a.level === b.level ? 0 : a.level === BADGE_LEVEL.CRITICAL ? -1 : 1,
        )
    );
  }

  /**
   * 4순위 — 하원·픽업 타임라인.
   *
   * 시간대(시 단위)로 묶는 이유: 분 단위로 나열하면 20줄이 되고, 원장이 알아야 하는 건
   * "몇 시가 몰리나"지 "누가 15:20인가"가 아니다(그건 원생 목록이 답한다).
   */
  private buildPickup(attendances: TodayAttendance[]) {
    const buckets = new Map<string, number>();
    const shuttles = new Map<number, number>();
    let unset = 0;

    for (const { pet } of attendances) {
      if (!pet.pickupTime) {
        unset += 1;
      } else {
        const hour = pet.pickupTime.slice(0, 2);
        buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
      }

      if (pet.pickupMethod === "SHUTTLE" && pet.shuttleNumber !== null) {
        shuttles.set(
          pet.shuttleNumber,
          (shuttles.get(pet.shuttleNumber) ?? 0) + 1,
        );
      }
    }

    return {
      hours: [...buckets.entries()]
        .map(([hour, count]) => ({ hour: `${hour}시`, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      shuttles: [...shuttles.entries()]
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => a.number - b.number),
      // 픽업 시각을 안 넣은 아이 — 타임라인이 조용히 틀리는 유일한 원인이라 밝힌다.
      unsetCount: unset,
    };
  }

  /**
   * 5순위 — 이용권 잔여.
   *
   * ⚠️ 스펙의 "미결제 건수"는 **지금 표현할 수 없다.** 이 스키마에서 매출(`TenantSale`)은
   * 돈을 받은 시점에만 생기고, 외상/미수금 개념이 없다. 없는 것을 0으로 그리면 원장은
   * "미결제가 없다"고 읽는데 그건 거짓이므로, 아예 내려주지 않는다.
   * 필요해지면 그때 `TenantSale.status` 또는 별도 미수금 모델을 먼저 만들어야 한다.
   */
  private async buildPasses(petIds: string[]) {
    if (petIds.length === 0) return { lowBalance: [] };

    const latest = await tenantTransaction(prisma, (tx) =>
      tx.subscriptionLedger.findMany({
        where: { petId: { in: petIds } },
        orderBy: [{ petId: "asc" }, { createdAt: "desc" }],
        distinct: ["petId"],
        select: {
          petId: true,
          balanceAfter: true,
          pet: { select: { name: true } },
        },
      }),
    );

    return {
      lowBalance: latest
        .filter((row) => row.balanceAfter <= LOW_PASS_THRESHOLD)
        .map((row) => ({
          petId: row.petId,
          name: row.pet?.name ?? "",
          balance: row.balanceAfter,
        }))
        .sort((a, b) => a.balance - b.balance),
    };
  }
}

/**
 * `getDashboard` 의 `include` 로 뽑은 오늘의 출석 한 건.
 *
 * Prisma 에서 유도하면(`Prisma.AttendanceGetPayload`) select 목록을 두 번 적게 되고,
 * 둘이 어긋나면 컴파일은 통과하고 런타임만 `undefined` 가 된다. 여기서는 위의 select 가
 * 곧 이 모양이므로 한 번만 적는다 — 필드를 늘릴 때 **양쪽을 같이** 고칠 것.
 */
interface TodayAttendance {
  status: string;
  pet: {
    id: string;
    name: string;
    allergies: string[];
    temperaments: string[];
    marksIndoors: boolean | null;
    mountingBehavior: boolean | null;
    hasBiteHistory: boolean | null;
    vaccinations: unknown;
    adaptationStartedAt: Date | null;
    pickupTime: string | null;
    pickupMethod: string | null;
    shuttleNumber: number | null;
  };
}
