import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { prisma, runWithoutTenant } from "@pawlog/database";
import * as crypto from "crypto";

import { seatConfig } from "../../shared/configs/seat.config";
import { IssueBillingKeyDto } from "../dtos";
import {
  TossClientService,
  type TossBillingKeyResponse,
  type TossPaymentResponse,
} from "./toss-client.service";

/** 매장 개설권 요금제 식별자. 원생 이용권(TENANT)과 같은 테이블에 섞여 있어 반드시 걸러야 한다. */
const PLATFORM_SCOPE = "PLATFORM";

const SUBSCRIPTION_STATUS = {
  ACTIVE: "ACTIVE",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
  FAIL_PAUSED: "FAIL_PAUSED",
} as const;

/**
 * 매장 개설권 구독 (job-034).
 *
 * 원생 이용권(SubscriptionService)과 달리 **주체가 회원**이고 테넌트가 생기기 전에 결제된다.
 * 결제가 성사되면 tenantId 가 비어 있는 UserSubscription("미사용 개설권")이 발급되고,
 * 테넌트 온보딩이 그중 하나를 소비한다. UserSubscription.tenantId 가 UNIQUE 이므로
 * 구독 1건으로 매장 1개만 열 수 있다.
 *
 * 이 도메인은 전부 테넌트 스코프 밖이라(회원 소유) runWithoutTenant 로 감싼다 —
 * 테넌트 컨텍스트가 열린 요청(예: 매장 안에서 2호점 결제)에서도 동작해야 하기 때문이다.
 */
@Injectable()
export class PlatformSubscriptionService {
  private readonly logger = new Logger(PlatformSubscriptionService.name);

  constructor(private readonly toss: TossClientService) {}

  /**
   * 판매 중인 매장 개설권 요금제 목록 (공개).
   *
   * `paymentRequired` 를 함께 내리는 이유(job-056): 결제 없이 발급되는 상태인지를 화면이
   * **누르기 전에** 알려줘야 한다. 같은 값을 프런트 환경변수로 한 번 더 두면 두 곳이
   * 어긋나는 순간 화면이 거짓말을 하므로(이 저장소의 `PROJECT_NAME` 이 그렇게 갈렸다),
   * 서버 설정 하나를 그대로 실어 보낸다.
   */
  async listPlans() {
    const plans = await prisma.subscriptionPlan.findMany({
      // job-051: 개설권은 pawlog 가 파는 상품이라 주인이 없다(`tenantId: null`).
      // scope 만으로도 걸러지지만, 두 조건을 함께 걸어 "주인 있는 요금제가 개설권 목록에
      // 섞여 나오는" 상태를 조회 단계에서도 불가능하게 둔다 (DB CHECK 제약과 같은 불변식).
      where: { scope: PLATFORM_SCOPE, tenantId: null, isActive: true },
      orderBy: { price: "asc" },
    });

    return { plans, paymentRequired: !seatConfig.allowUnpaid };
  }

  /** 회원 소유 빌링키 등록 (카드 등록) */
  async registerBillingKey(userId: string, dto: IssueBillingKeyDto) {
    const res = await this.toss.request<TossBillingKeyResponse>(
      "/billing/authorizations/issue",
      { authKey: dto.authKey, customerKey: dto.customerKey },
    );

    const billingKey = await runWithoutTenant(() =>
      prisma.userBillingKey.upsert({
        where: { userId },
        update: {
          customerKey: dto.customerKey,
          billingKey: res.billingKey,
          cardName: res.card?.name || null,
          cardNumber: res.card?.number || null,
        },
        create: {
          userId,
          customerKey: dto.customerKey,
          billingKey: res.billingKey,
          cardName: res.card?.name || null,
          cardNumber: res.card?.number || null,
        },
      }),
    );

    return {
      cardName: billingKey.cardName,
      cardNumber: billingKey.cardNumber,
    };
  }

  /**
   * 매장 개설권 구독 및 첫 결제.
   * 성공하면 tenantId 가 비어 있는 미사용 개설권 1건이 발급된다.
   *
   * `ALLOW_UNPAID_TENANT_SEAT=true` 면 카드/결제를 건너뛰고 개설권만 발급한다(job-056).
   * 그 판단은 `seat.config.ts` 한 곳에 있고, **토스 설정 여부로 추론하지 않는다** —
   * 이유는 그 파일 주석 참조.
   */
  async subscribe(userId: string, planId: string) {
    const plan = await this.findSellablePlan(planId);

    if (seatConfig.allowUnpaid) {
      return this.issueUnpaidEntitlement(userId, plan);
    }

    const billingKey = await runWithoutTenant(() =>
      prisma.userBillingKey.findUnique({ where: { userId } }),
    );
    if (!billingKey) {
      throw new BadRequestException(
        "등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.",
      );
    }

    const orderId = `tenant_seat_${crypto.randomUUID().replace(/-/g, "")}`;
    const payment = await this.toss.request<TossPaymentResponse>(
      `/billing/${billingKey.billingKey}`,
      {
        customerKey: billingKey.customerKey,
        amount: plan.price,
        orderId,
        orderName: plan.name,
      },
    );

    const subscription = await this.createEntitlement(
      userId,
      plan,
      billingKey.id,
    );

    return { subscription, paymentKey: payment.paymentKey, paid: true };
  }

  /**
   * 결제 없이 개설권을 발급한다 (job-056) — 결제 연동 전에 개설 흐름을 끝까지 돌려보기 위한 경로.
   *
   * 발급 건마다 경고를 남긴다. 이 토글은 언젠가 꺼야 하는 임시 상태인데, 조용히 성공하면
   * 켜져 있다는 사실 자체가 잊힌다. 로그에 남아 있으면 정산 때 "이 기간에 무료로 나간 건"을
   * DB(`billing_key_id IS NULL`)와 대조할 수 있다.
   */
  private async issueUnpaidEntitlement(
    userId: string,
    plan: { id: string; name: string; price: number; interval: string },
  ) {
    const subscription = await this.createEntitlement(userId, plan, null);

    this.logger.warn(
      `[ALLOW_UNPAID_TENANT_SEAT] 결제 없이 개설권을 발급했습니다. ` +
        `user=${userId} plan=${plan.name}(${plan.id}) price=${plan.price} subscription=${subscription.id}`,
    );

    return { subscription, paymentKey: null, paid: false };
  }

  /** 요금제를 확인한다 — 개설권(PLATFORM)이 아니거나 판매 중지면 여기서 멈춘다. */
  private async findSellablePlan(planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || plan.scope !== PLATFORM_SCOPE) {
      throw new NotFoundException("존재하지 않는 매장 개설권 요금제입니다.");
    }
    if (!plan.isActive) {
      throw new BadRequestException("판매 중지된 요금제입니다.");
    }
    return plan;
  }

  /**
   * 미사용 개설권 1건을 만든다. 결제 여부와 무관하게 발급 형태는 같아야 온보딩이
   * 두 경로를 구분하지 않는다 — 다른 것은 `billingKeyId` 뿐이고, 그게 곧 결제 흔적이다.
   */
  private async createEntitlement(
    userId: string,
    plan: { id: string; interval: string },
    billingKeyId: string | null,
  ) {
    const now = new Date();
    const nextPaymentDate = this.addInterval(now, plan.interval);

    return runWithoutTenant(() =>
      prisma.userSubscription.create({
        data: {
          userId,
          planId: plan.id,
          billingKeyId,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          startDate: now,
          endDate: nextPaymentDate,
          nextPaymentDate,
        },
      }),
    );
  }

  /** 내 매장 개설권 목록 (사용/미사용 모두). 어느 매장에 쓰였는지 함께 보여준다. */
  async listMine(userId: string) {
    const subscriptions = await runWithoutTenant(() =>
      prisma.userSubscription.findMany({
        where: { userId },
        include: {
          plan: true,
          tenant: { select: { id: true, name: true, subdomain: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    return { subscriptions };
  }

  /**
   * 아직 매장을 열지 않은 개설권 1건을 찾는다 (온보딩 게이트).
   * 없으면 null — 호출부가 상황에 맞는 예외를 던진다.
   */
  async findUnusedEntitlement(userId: string) {
    return runWithoutTenant(() =>
      prisma.userSubscription.findFirst({
        where: {
          userId,
          tenantId: null,
          status: SUBSCRIPTION_STATUS.ACTIVE,
        },
        orderBy: { createdAt: "asc" }, // 먼저 산 것부터 소비
      }),
    );
  }

  /** 온보딩이 개설권을 소비할 수 없으면 사유를 담아 403 을 던진다. */
  async assertCanOpenTenant(userId: string) {
    const entitlement = await this.findUnusedEntitlement(userId);
    if (!entitlement) {
      throw new ForbiddenException(
        "매장을 개설하려면 개설권 구독이 필요합니다. 요금제를 결제한 뒤 다시 시도해주세요.",
      );
    }
    return entitlement;
  }

  /** 구독 해지 예약 — 즉시 끊지 않고 만료일까지 유지한다. */
  async cancel(userId: string, subscriptionId: string) {
    const subscription = await runWithoutTenant(() =>
      prisma.userSubscription.findFirst({
        where: { id: subscriptionId, userId },
      }),
    );
    if (!subscription) {
      throw new NotFoundException("존재하지 않는 구독입니다.");
    }
    if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
      throw new BadRequestException("이미 해지되었거나 만료된 구독입니다.");
    }

    const updated = await runWithoutTenant(() =>
      prisma.userSubscription.update({
        where: { id: subscriptionId },
        data: { status: SUBSCRIPTION_STATUS.CANCELED },
      }),
    );
    return { subscription: updated };
  }

  private addInterval(from: Date, interval: string): Date {
    const next = new Date(from);
    if (interval === "YEARLY") {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }
}
