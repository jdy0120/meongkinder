import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  prisma,
  Prisma,
  getTenantId,
  requireTenantId,
  runWithoutTenant,
  runWithTenant,
  tenantTransaction,
} from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import * as crypto from "crypto";
import { tossAuthHeader, tossConfig } from "../../shared/configs/toss.config";
import {
  CreateSubscriptionDto,
  CreateSubscriptionPlanDto,
  IssueBillingKeyDto,
  UpdateSubscriptionPlanDto,
} from "../dtos";

interface TossBillingKeyResponse {
  billingKey: string;
  card?: {
    name?: string;
    number?: string;
  };
}

interface TossPaymentResponse {
  paymentKey: string;
  method?: string;
  approvedAt: string;
}

interface TossErrorResponse {
  code?: string;
  message?: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  /** 토스 API 공통 호출 헬퍼 (Basic 인증 + JSON) */
  private async tossRequest<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!tossConfig.isConfigured) {
      throw new ServiceUnavailableException(
        "결제 설정이 되어있지 않습니다. (TOSS_SECRET_KEY 미설정)",
      );
    }

    let res: Response;
    try {
      res = await fetch(`${tossConfig.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: tossAuthHeader(),
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      this.logger.error(`토스 API 통신 실패: ${path}`, e as Error);
      throw new ServiceUnavailableException(
        "결제 서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    }

    const data = (await res.json().catch(() => ({}))) as TossErrorResponse & T;
    if (!res.ok) {
      this.logger.warn(
        `토스 API 오류 ${res.status}: ${data?.code} ${data?.message}`,
      );
      throw new BadRequestException(
        data?.message || "결제 처리 중 오류가 발생했습니다.",
      );
    }
    return data as T;
  }

  /**
   * 요금제 목록 조회 (공개, 판매 활성화된 요금제만).
   * job-034: 매장 개설권(scope=PLATFORM)은 여기 노출되면 안 된다 — 보호자가 살 상품이 아니다.
   * 개설권 목록은 GET v1/platform-subscriptions/plans 가 담당한다.
   *
   * job-051: **이용권은 유치원 상품이므로 그 유치원의 것만 내린다.** 예전에는 테넌트 조건이
   * 없어서 A유치원이 만든 "10회권"이 B유치원 목록에도 떴다 — 상품명·가격이 그대로 새어
   * 나가는 경로였고, 공개(@Public) 엔드포인트라 로그인조차 필요 없었다.
   *
   * 테넌트가 정해지지 않은 요청(개인 스코프)은 **빈 목록**이다. 예외를 던지지 않는 이유는
   * 이 경로가 로그인 전에도 열리는 매장 소개용이라, 잘못된 주소로 들어온 방문자에게
   * 500 대신 "판매 중인 상품 없음"을 보여주는 편이 맞기 때문이다.
   */
  async listPlans() {
    const tenantId = getTenantId();
    if (!tenantId) return [];

    return prisma.subscriptionPlan.findMany({
      where: { isActive: true, scope: "TENANT", tenantId },
      orderBy: { price: "asc" },
    });
  }

  /**
   * 요금제 전체 목록 조회 (원장, 비활성 포함, 페이지네이션).
   *
   * job-051: **이 유치원이 파는 이용권만** 내린다. 예전에는 where 가 통째로 비어 있어
   * 다른 유치원의 요금제는 물론 매장 개설권(scope=PLATFORM)까지 한 화면에 섞여 나왔다.
   * `tenantTransaction` 을 쓰고 있었지만 SubscriptionPlan 은 Prisma 테넌트 스코프 확장의
   * 대상이 아니라(전역 공용 모델로 분류돼 있다) 자동 주입이 걸리지 않았다 — 스코프가
   * 걸린 것처럼 보이지만 실제로는 안 걸리는, 가장 나쁜 형태였다.
   */
  async listAllPlans(query: PaginationQuery) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);
    const where = { scope: "TENANT", tenantId: requireTenantId() };

    const [items, total] = await prisma.$transaction([
      prisma.subscriptionPlan.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
      }),
      prisma.subscriptionPlan.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 요금제 상세 조회 (원장).
   * job-051: 다른 유치원의 요금제 id 를 넣어도 조회되지 않도록 tenantId 를 함께 건다.
   * 없는 것과 남의 것을 같은 404 로 처리한다 — 구분해 주면 id 를 넣어보는 것만으로
   * 다른 유치원 상품의 존재를 알 수 있다.
   */
  async getPlan(id: string) {
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id, scope: "TENANT", tenantId: requireTenantId() },
    });
    if (!plan) {
      throw new NotFoundException("존재하지 않는 요금제입니다.");
    }
    return { plan };
  }

  /**
   * 요금제 등록 (원장) — 10회권/월 무제한/1일권 등 이 유치원이 파는 상품을 만든다.
   * job-051: `tenantId` 는 요청 본문이 아니라 **테넌트 컨텍스트**에서 온다. 본문으로 받으면
   * 남의 유치원 id 를 실어 상품을 심을 수 있다.
   */
  async createPlan(dto: CreateSubscriptionPlanDto) {
    this.assertPlanShapeValid(dto);

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        price: dto.price,
        interval: dto.interval,
        description: dto.description,
        planType: dto.planType,
        totalCount: dto.totalCount,
        validityDays: dto.validityDays,
        isActive: dto.isActive ?? true,
        scope: "TENANT",
        tenantId: requireTenantId(),
      },
    });
    return { plan };
  }

  /** 요금제 수정 (원장) */
  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    await this.getPlan(id); // 소유 검증 겸 존재 확인
    this.assertPlanShapeValid(dto);

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
        interval: dto.interval,
        description: dto.description,
        planType: dto.planType,
        totalCount: dto.totalCount,
        validityDays: dto.validityDays,
        isActive: dto.isActive,
      },
    });
    return { plan };
  }

  /** 요금제 판매 중지 (ADMIN, soft delete — 기존 구독 이력 보존을 위해 물리 삭제하지 않음) */
  async deletePlan(id: string) {
    await this.getPlan(id);
    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
    return { plan };
  }

  /** RECURRING 이 아닌 상품 유형은 유효기간/총 횟수 필드가 필요하다 */
  private assertPlanShapeValid(dto: {
    planType?: string;
    totalCount?: number;
    validityDays?: number;
  }) {
    if (!dto.planType) return;

    if (dto.planType !== "RECURRING" && !dto.validityDays) {
      throw new BadRequestException(
        "RECURRING 이 아닌 상품 유형은 validityDays(유효기간)가 필요합니다.",
      );
    }
    if (
      (dto.planType === "COUNT" || dto.planType === "PERIOD") &&
      !dto.totalCount
    ) {
      throw new BadRequestException(
        "COUNT/PERIOD 유형은 totalCount(총 제공 횟수)가 필요합니다.",
      );
    }
  }

  /** 빌링키 등록 (카드 등록). job-020: 빌링키 주체가 User -> Tenant 로 이동(테넌트당 1개). */
  async registerBillingKey(_userId: string, dto: IssueBillingKeyDto) {
    const tenantId = requireTenantId();
    const res = await this.tossRequest<TossBillingKeyResponse>(
      "/billing/authorizations/issue",
      {
        authKey: dto.authKey,
        customerKey: dto.customerKey,
      },
    );

    const billingKey = await prisma.tenantBillingKey.upsert({
      where: { tenantId },
      update: {
        customerKey: dto.customerKey,
        billingKey: res.billingKey,
        cardName: res.card?.name || null,
        cardNumber: res.card?.number || null,
      },
      create: {
        tenantId,
        customerKey: dto.customerKey,
        billingKey: res.billingKey,
        cardName: res.card?.name || null,
        cardNumber: res.card?.number || null,
      },
    });

    return {
      cardName: billingKey.cardName,
      cardNumber: billingKey.cardNumber,
    };
  }

  /**
   * 요금제 구독 신청 및 첫 결제 수행.
   * job-020: 구독/빌링키 주체가 User -> Tenant 로 이동. 결제 관련 Order/Payment 는
   * 여전히 호출 유저(userId)에 귀속된다.
   */
  async subscribe(userId: string, dto: CreateSubscriptionDto) {
    const tenantId = requireTenantId();

    // 1. 어느 아이의 이용권인지 먼저 확정한다 (job-051).
    //    이용권은 아이 단위 상품이므로 유형과 무관하게 대상이 있어야 한다. 예전에는
    //    COUNT/PERIOD 일 때만 아래에서 뒤늦게 확인해서, 한달권(UNLIMITED)은 **어느 아이
    //    것인지 모른 채** 구독만 만들어졌다 — 그게 일권/한달권을 구분할 수 없던 원인이다.
    if (!dto.petId) {
      throw new BadRequestException("어느 아이의 이용권인지 지정해야 합니다.");
    }
    const pet = await prisma.pet.findFirst({
      where: { id: dto.petId, tenantId },
      select: { id: true, userId: true },
    });
    if (!pet) {
      throw new NotFoundException("이 매장의 원생이 아닙니다.");
    }

    // 2. 중복 구독 검사 — **그 아이 기준**이다.
    //    job-051: 예전에는 테넌트 전체에 활성 구독이 하나라도 있으면 막았다. 이용권이
    //    아이 단위가 된 지금 그 검사를 두면 **두 번째 원생부터 아무것도 팔 수 없다.**
    //
    //    유형에 따라 판단이 갈린다:
    //      - 기간제(UNLIMITED/RECURRING): 같은 아이에게 겹치는 기간권을 두 장 파는 건 실수다.
    //      - 횟수제(COUNT/PERIOD): 다 쓰기 전에 미리 충전하는 건 정상 거래다. 잔액은
    //        SubscriptionLedger 가 합산하므로 여러 장이 살아 있어도 문제가 없다.
    const isPeriodPlan = (planType: string) =>
      planType === "UNLIMITED" || planType === "RECURRING";

    // 2. 빌링키가 등록되어 있는지 확인
    const billingKey = await prisma.tenantBillingKey.findUnique({
      where: { tenantId },
    });
    if (!billingKey) {
      throw new BadRequestException(
        "등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.",
      );
    }

    // 3. 플랜이 유효한지 확인
    // job-051: **이 유치원이 파는 요금제인지**까지 본다. tenantId 를 빼면 다른 유치원의
    // planId 를 실어 그 집 가격으로 우리 집 이용권을 살 수 있다(가격이 낮은 매장의
    // 요금제 id 만 알면 된다). scope 도 함께 걸어 개설권을 원생 이용권으로 사는 것도 막는다.
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: dto.planId, scope: "TENANT", tenantId },
    });
    if (!plan) {
      throw new NotFoundException("존재하지 않는 요금제입니다.");
    }

    // 기간제를 살 때만 그 아이의 겹치는 기간제를 막는다 (위 2번 주석 참고).
    if (isPeriodPlan(plan.planType)) {
      const overlapping = await prisma.tenantSubscription.findFirst({
        where: {
          tenantId,
          petId: pet.id,
          status: { in: ["ACTIVE", "CANCELED"] },
          plan: { planType: { in: ["UNLIMITED", "RECURRING"] } },
        },
      });
      if (overlapping) {
        throw new BadRequestException(
          "이 아이는 이미 이용 중인 기간권이 있습니다.",
        );
      }
    }

    const orderId = `sub_order_${crypto.randomUUID().replace(/-/g, "")}`;
    let tossPayment: TossPaymentResponse;

    // 4. 최초 결제 시도
    try {
      tossPayment = await this.tossRequest<TossPaymentResponse>(
        `/billing/${billingKey.billingKey}`,
        {
          customerKey: billingKey.customerKey,
          amount: plan.price,
          orderId,
          orderName: plan.name,
        },
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "최초 결제 승인 거절";
      // 결제 거절 시 FAILED 상태 및 에러 메시지를 failReason에 기록하여 주문 레코드 보존
      await prisma.order.create({
        data: {
          tenantId,
          orderId,
          userId,
          orderName: plan.name,
          amount: plan.price,
          status: "FAILED",
          failReason: errMsg,
        },
      });
      throw err;
    }

    // 5. 결제 성공 시 트랜잭션 처리
    const startDate = new Date();
    const endDate = new Date();
    if (plan.planType !== "RECURRING") {
      // COUNT/UNLIMITED/PERIOD: 유효기간(일) 기반으로 만료일 계산 (자동갱신 없음)
      endDate.setDate(endDate.getDate() + (plan.validityDays ?? 0));
    } else if (plan.interval === "YEARLY") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    const nextPaymentDate = endDate;

    const [, , subscription] = await tenantTransaction(prisma, async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          orderId,
          userId,
          orderName: plan.name,
          amount: plan.price,
          status: "PAID",
        },
      });
      const payment = await tx.payment.create({
        data: {
          tenantId,
          paymentKey: tossPayment.paymentKey,
          orderId,
          method: tossPayment.method ?? "카드",
          amount: plan.price,
          status: "DONE",
          approvedAt: new Date(tossPayment.approvedAt),
          rawData: tossPayment as unknown as Prisma.InputJsonValue, // JSON safe cast
        },
      });
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          petId: pet.id, // job-051: 이용권의 주인
          billingKeyId: billingKey.id,
          status: "ACTIVE",
          startDate,
          endDate,
          nextPaymentDate,
        },
      });

      // job-051: 매출 원장. 카드 결제라 토스 기록(payment)을 가리킨다.
      // 이 한 줄이 없으면 월별 매출에서 카드 판매가 통째로 빠진다.
      await tx.tenantSale.create({
        data: {
          tenantId,
          planId: plan.id,
          petId: pet.id,
          subscriptionId: subscription.id,
          paymentId: payment.id,
          amount: plan.price,
          method: "CARD",
          soldAt: payment.approvedAt ?? new Date(),
        },
      });

      // 횟수제(COUNT/PERIOD)는 구매 즉시 총 제공 횟수만큼 잔여 횟수를 충전한다.
      // job-051: 구독 생성과 **같은 트랜잭션** 안으로 옮겼다. 예전에는 트랜잭션 밖에 있어
      // 여기서 실패하면 "구독은 있는데 잔액이 0" 인 상태가 남았고, 그 아이는 등원할 때마다
      // "잔여 이용권 없음" 경고를 받으면서도 원장 화면에는 정상 구독으로 보였다.
      if (
        (plan.planType === "COUNT" || plan.planType === "PERIOD") &&
        plan.totalCount
      ) {
        const lastLedger = await tx.subscriptionLedger.findFirst({
          where: { petId: pet.id },
          orderBy: { createdAt: "desc" },
        });
        const currentBalance = lastLedger?.balanceAfter ?? 0;

        await tx.subscriptionLedger.create({
          data: {
            tenantId,
            petId: pet.id,
            userId: pet.userId,
            subscriptionId: subscription.id,
            type: "CHARGE",
            amount: plan.totalCount,
            balanceAfter: currentBalance + plan.totalCount,
            description: `${plan.name} 구매에 따른 잔여 횟수 충전`,
          },
        });
      }

      return [order, payment, subscription] as const;
    });

    return { subscription };
  }

  /** 이용 중인 정기권 일시정지 (휴회). job-020: 구독 주체가 Tenant 로 이동, ALS 로 스코프. */
  async pause(_userId: string) {
    const activeSub = await prisma.tenantSubscription.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    if (!activeSub) {
      throw new NotFoundException("이용 중인 활성 구독이 없습니다.");
    }

    const subscription = await prisma.tenantSubscription.update({
      where: { id: activeSub.id },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    return { subscription };
  }

  /** 일시정지(휴회) 해제 및 재개 — 정지된 기간만큼 유효기간/다음 결제일을 연장한다 */
  async resume(_userId: string) {
    const pausedSub = await prisma.tenantSubscription.findFirst({
      where: { status: "PAUSED" },
      orderBy: { createdAt: "desc" },
    });
    if (!pausedSub || !pausedSub.pausedAt) {
      throw new NotFoundException("일시정지(휴회) 중인 구독이 없습니다.");
    }

    const pausedDurationMs = Date.now() - pausedSub.pausedAt.getTime();
    const endDate = new Date(pausedSub.endDate.getTime() + pausedDurationMs);
    const nextPaymentDate = new Date(
      pausedSub.nextPaymentDate.getTime() + pausedDurationMs,
    );

    const subscription = await prisma.tenantSubscription.update({
      where: { id: pausedSub.id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        endDate,
        nextPaymentDate,
      },
    });
    return { subscription };
  }

  /**
   * 보호자 - 나의 정기권/회수권(티켓) 목록 + 잔여 횟수.
   *
   * ## 조회 축은 계정, 소유 단위는 아이 (job-055)
   *
   * 이 둘은 대립하지 않는다. "내 화면"이므로 필터는 계정에서 출발하지만, 이용권의 주인은
   * 아이라서(`TenantSubscription.petId`, job-051) 경로가 **계정 → 아이 → 이용권** 이 된다.
   * 이용권을 계정에 직접 매달 수 없는 이유는 스키마 주석에 남아 있다 — 계정 없이 등록된
   * 원생(job-040)과 형제견(job-045).
   *
   * 예전에는 `_userId` 를 받아만 놓고 `where` 없이 전체를 읽었다. 개인 화면이라 활성 테넌트가
   * 없고, 테넌트 스코프 익스텐션은 tenantId 가 없으면 주입을 건너뛰므로 **필터가 하나도 걸리지
   * 않아 모든 매장의 이용권이 아무 계정에나 그대로 내려갔다**(가입 직후 아이 0마리인 계정에도).
   *
   * `runWithoutTenant` 로 감싸는 이유: 소유 판단이 이미 아이로 끝났고, 보호자는 두 유치원에
   * 맡겼어도 한 화면에서 봐야 한다. 감싸지 않으면 매장을 열어 둔 상태에서 이 화면에 들어왔을
   * 때만 목록이 그 매장으로 좁아져, 같은 화면이 경로에 따라 다르게 보인다.
   */
  async getMyTickets(userId: string) {
    const subscriptions = await runWithoutTenant(() =>
      prisma.tenantSubscription.findMany({
        where: { pet: { userId } },
        include: {
          plan: true,
          // 형제견을 구분하려면 어느 아이 것인지가 카드에 있어야 한다.
          pet: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    if (subscriptions.length === 0) {
      return { tickets: [] };
    }

    const sums = await runWithoutTenant(() =>
      prisma.subscriptionLedger.groupBy({
        by: ["subscriptionId"],
        where: { subscriptionId: { in: subscriptions.map((s) => s.id) } },
        _sum: { amount: true },
      }),
    );
    const balanceBySubscriptionId = new Map(
      sums.map((s) => [s.subscriptionId, s._sum.amount ?? 0]),
    );

    const tickets = subscriptions.map((subscription) => ({
      subscription,
      remainingCount:
        subscription.plan.planType === "COUNT" ||
        subscription.plan.planType === "PERIOD"
          ? (balanceBySubscriptionId.get(subscription.id) ?? 0)
          : null,
    }));

    return { tickets };
  }

  /**
   * 특정 정기권/회수권의 사용 내역 (페이지네이션, **본인 아이의 것만**).
   *
   * 소유 검사를 `getMyTickets` 와 같은 축(계정 → 아이)으로 명시한다. 예전 주석은 "ALS tenantId
   * 가 자동 주입되므로 다른 테넌트 구독 id 는 조회되지 않는다"고 적혀 있었지만, 이 화면은
   * 매장 게이트 바깥이라 활성 테넌트가 없고 익스텐션도 그때는 주입을 건너뛴다 — 즉 그 방어는
   * 이 경로에서 작동하지 않았고, 실제로 남의 매장 구독 id 로 사용 내역이 열렸다.
   *
   * 없는 id 와 남의 id 를 모두 404 로 답한다(403 이면 "그 id 는 존재한다"를 알려주는 셈).
   */
  async getUsageHistory(
    userId: string,
    subscriptionId: string,
    query: PaginationQuery,
  ) {
    const subscription = await runWithoutTenant(() =>
      prisma.tenantSubscription.findFirst({
        where: { id: subscriptionId, pet: { userId } },
        select: { id: true },
      }),
    );
    if (!subscription) {
      throw new NotFoundException("존재하지 않는 정기권/회수권입니다.");
    }

    const { page, pageSize, skip, take, order } = resolvePagination(query);
    // 소유 판단이 아이로 끝났으므로 테넌트 스코프를 벗어나 읽는다 — 그러지 않으면 매장을
    // 열어 둔 상태에서만 내역이 보이거나(다른 매장 이용권), 아예 비어 보인다.
    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction([
        prisma.subscriptionLedger.findMany({
          where: { subscriptionId },
          skip,
          take,
          orderBy: { createdAt: order },
        }),
        prisma.subscriptionLedger.count({ where: { subscriptionId } }),
      ]),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 구독 해지 신청 (결제 주기가 만료될 때까지 이용 가능, 이후 EXPIRED 로 전환).
   * job-020: 구독 주체가 Tenant 로 이동, ALS 로 스코프한다.
   */
  async cancel(_userId: string) {
    const activeSub = await prisma.tenantSubscription.findFirst({
      where: {
        status: "ACTIVE",
      },
    });

    if (!activeSub) {
      throw new NotFoundException("이용 중인 활성 구독이 없습니다.");
    }

    const updated = await prisma.tenantSubscription.update({
      where: { id: activeSub.id },
      data: { status: "CANCELED" },
    });

    return { subscription: updated };
  }

  /**
   * 현재 나의 구독 상태 확인.
   * job-020: 구독/빌링키 주체가 Tenant 로 이동, ALS 로 스코프한다.
   */
  async getMySubscription(_userId: string) {
    // job-033: 활성 테넌트가 없으면(개인 스코프) 이 매장 구독 개념 자체가 없다.
    // requireTenantId() 는 raw Error 를 던져 500 이 되므로, 먼저 확인해 빈 응답으로 답한다.
    const tenantId = getTenantId();
    if (!tenantId) {
      return { subscription: null, billingKey: null };
    }

    const subscription = await prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ["ACTIVE", "CANCELED", "FAIL_PAUSED"] },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const billingKey = await prisma.tenantBillingKey.findUnique({
      where: { tenantId },
      select: {
        cardName: true,
        cardNumber: true,
      },
    });

    return {
      subscription,
      billingKey,
    };
  }

  /**
   * 정기 결제 갱신 배치 (스케줄러에서 자동 실행).
   * @Cron 은 요청 컨텍스트 밖이라 ALS 에 tenantId 가 없다 — 활성 테넌트 목록을 bypass 로 조회한 뒤
   * 테넌트별로 runWithTenant 컨텍스트를 열어 처리한다(SET LOCAL/RLS·Prisma Extension 자동 스코프 적용).
   * job-020: 구독 주체가 Tenant 로 이동. Order/Payment 는 여전히 User 귀속(non-null)이라
   * 편의상 해당 테넌트에 소속된 사용자 1명을 찾아 귀속시킨다.
   */
  async processRenewals() {
    const tenants = await runWithoutTenant(() =>
      prisma.tenant.findMany({ where: { isActive: true } }),
    );

    for (const tenant of tenants) {
      await runWithTenant(tenant.id, () => this.processRenewalsForTenant());
    }
  }

  private async processRenewalsForTenant() {
    const today = new Date();
    // nextPaymentDate가 오늘 이하이고 status가 ACTIVE인 RECURRING 요금제 구독만 대상
    // (COUNT/UNLIMITED/PERIOD 유형의 정기권/회수권은 자동갱신 없이 유효기간 만료로 처리됨)
    const renewals = await prisma.tenantSubscription.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: {
          lte: today,
        },
        plan: { planType: "RECURRING" },
      },
      include: {
        plan: true,
        billingKey: true,
      },
    });

    if (renewals.length > 0) {
      this.logger.log(`갱신 정기 결제 대상: ${renewals.length}건`);
    }

    for (const sub of renewals) {
      if (!sub.billingKey) {
        this.logger.error(
          `구독 ID ${sub.id}에 연동된 결제 정보가 없습니다. FAIL_PAUSED 로 보류 처리합니다.`,
        );
        await prisma.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: "FAIL_PAUSED" },
        });
        continue;
      }

      const tenantUser = await prisma.user.findFirst({});
      if (!tenantUser) {
        this.logger.error(
          `테넌트 ID ${sub.tenantId} 에 소속된 사용자가 없어 구독 ID ${sub.id} 갱신 주문을 귀속시킬 수 없습니다. 건너뜁니다.`,
        );
        continue;
      }

      const orderId = `renew_${crypto.randomUUID().replace(/-/g, "")}`;
      try {
        const tossPayment = await this.tossRequest<TossPaymentResponse>(
          `/billing/${sub.billingKey.billingKey}`,
          {
            customerKey: sub.billingKey.customerKey,
            amount: sub.plan.price,
            orderId,
            orderName: `${sub.plan.name} 정기 결제`,
          },
        );

        // 다음 갱신 결제일 계산
        const nextPaymentDate = new Date(sub.nextPaymentDate);
        if (sub.plan.interval === "YEARLY") {
          nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
        } else {
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }

        await tenantTransaction(prisma, async (tx) => {
          await tx.order.create({
            data: {
              tenantId: sub.tenantId,
              orderId,
              userId: tenantUser.id,
              orderName: `${sub.plan.name} 정기 결제`,
              amount: sub.plan.price,
              status: "PAID",
            },
          });
          await tx.payment.create({
            data: {
              tenantId: sub.tenantId,
              paymentKey: tossPayment.paymentKey,
              orderId,
              method: tossPayment.method ?? "카드",
              amount: sub.plan.price,
              status: "DONE",
              approvedAt: new Date(tossPayment.approvedAt),
              rawData: tossPayment as unknown as Prisma.InputJsonValue, // JSON safe cast
            },
          });
          await tx.tenantSubscription.update({
            where: { id: sub.id },
            data: {
              startDate: sub.nextPaymentDate,
              endDate: nextPaymentDate,
              nextPaymentDate,
            },
          });
        });

        this.logger.log(`구독 ID ${sub.id} 정기결제 성공!`);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "정기 자동 승인 거절";
        this.logger.error(`구독 ID ${sub.id} 정기결제 실패: ${errMsg}`);

        await tenantTransaction(prisma, async (tx) => {
          await tx.order.create({
            data: {
              tenantId: sub.tenantId,
              orderId,
              userId: tenantUser.id,
              orderName: `${sub.plan.name} 정기 결제`,
              amount: sub.plan.price,
              status: "FAILED",
              failReason: errMsg,
            },
          });
          await tx.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: "FAIL_PAUSED" },
          });
        });
      }
    }
  }

  /**
   * 만료된 구독/정기권 정리 배치 (스케줄러에서 자동 실행).
   * 활성 테넌트를 순회하며 각 테넌트 컨텍스트 안에서 만료 처리한다.
   */
  async processExpirations() {
    const tenants = await runWithoutTenant(() =>
      prisma.tenant.findMany({ where: { isActive: true } }),
    );

    for (const tenant of tenants) {
      await runWithTenant(tenant.id, () => this.processExpirationsForTenant());
    }
  }

  private async processExpirationsForTenant() {
    const today = new Date();
    // CANCELED(해지예정) 구독 또는 ACTIVE 상태의 COUNT/UNLIMITED/PERIOD 정기권(자동갱신 없음)
    // 중 유효기간이 지난 건을 EXPIRED 로 정리 (PAUSED 는 휴회 중이므로 제외)
    const expiredResult = await prisma.tenantSubscription.updateMany({
      where: {
        status: { in: ["CANCELED", "ACTIVE"] },
        endDate: {
          lte: today,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    if (expiredResult.count > 0) {
      this.logger.log(
        `만료일이 도래한 구독/정기권 ${expiredResult.count}건을 EXPIRED 로 변경 완료했습니다.`,
      );
    }
  }
}
