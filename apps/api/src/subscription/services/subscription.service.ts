import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma, Prisma } from "@template/database";
import * as crypto from "crypto";
import { tossAuthHeader, tossConfig } from "../../shared/configs/toss.config";
import { CreateSubscriptionDto, IssueBillingKeyDto } from "../dtos";

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

  /** 요금제 목록 조회 */
  async listPlans() {
    return prisma.subscriptionPlan.findMany({
      orderBy: { price: "asc" },
    });
  }

  /** 빌링키 등록 (카드 등록) */
  async registerBillingKey(userId: string, dto: IssueBillingKeyDto) {
    const res = await this.tossRequest<TossBillingKeyResponse>(
      "/billing/authorizations/issue",
      {
        authKey: dto.authKey,
        customerKey: dto.customerKey,
      },
    );

    const billingKey = await prisma.billingKey.upsert({
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
    });

    return {
      cardName: billingKey.cardName,
      cardNumber: billingKey.cardNumber,
    };
  }

  /** 요금제 구독 신청 및 첫 결제 수행 */
  async subscribe(userId: string, dto: CreateSubscriptionDto) {
    // 1. 기존 활성 구독이 있는지 확인
    const activeSub = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "CANCELED"] },
      },
    });
    if (activeSub) {
      throw new BadRequestException("이미 이용 중인 구독이 존재합니다.");
    }

    // 2. 빌링키가 등록되어 있는지 확인
    const billingKey = await prisma.billingKey.findUnique({
      where: { userId },
    });
    if (!billingKey) {
      throw new BadRequestException(
        "등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.",
      );
    }

    // 3. 플랜이 유효한지 확인
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) {
      throw new NotFoundException("존재하지 않는 요금제입니다.");
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
    if (plan.interval === "YEARLY") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    const nextPaymentDate = endDate;

    const [subscription] = await prisma.$transaction([
      prisma.order.create({
        data: {
          orderId,
          userId,
          orderName: plan.name,
          amount: plan.price,
          status: "PAID",
        },
      }),
      prisma.payment.create({
        data: {
          paymentKey: tossPayment.paymentKey,
          orderId,
          method: tossPayment.method ?? "카드",
          amount: plan.price,
          status: "DONE",
          approvedAt: new Date(tossPayment.approvedAt),
          rawData: tossPayment as unknown as Prisma.InputJsonValue, // JSON safe cast
        },
      }),
      prisma.userSubscription.create({
        data: {
          userId,
          planId: plan.id,
          billingKeyId: billingKey.id,
          status: "ACTIVE",
          startDate,
          endDate,
          nextPaymentDate,
        },
      }),
    ]);

    return { subscription };
  }

  /** 구독 해지 신청 (결제 주기가 만료될 때까지 이용 가능, 이후 EXPIRED 로 전환) */
  async cancel(userId: string) {
    const activeSub = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
    });

    if (!activeSub) {
      throw new NotFoundException("이용 중인 활성 구독이 없습니다.");
    }

    const updated = await prisma.userSubscription.update({
      where: { id: activeSub.id },
      data: { status: "CANCELED" },
    });

    return { subscription: updated };
  }

  /** 현재 나의 구독 상태 확인 */
  async getMySubscription(userId: string) {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "CANCELED", "FAIL_PAUSED"] },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const billingKey = await prisma.billingKey.findUnique({
      where: { userId },
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

  /** 정기 결제 갱신 배치 (스케줄러에서 자동 실행) */
  async processRenewals() {
    const today = new Date();
    // nextPaymentDate가 오늘 이하이고 status가 ACTIVE인 구독 대상
    const renewals = await prisma.userSubscription.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDate: {
          lte: today,
        },
      },
      include: {
        plan: true,
        billingKey: true,
      },
    });

    this.logger.log(`갱신 정기 결제 대상: ${renewals.length}건`);

    for (const sub of renewals) {
      if (!sub.billingKey) {
        this.logger.error(
          `구독 ID ${sub.id}에 연동된 결제 정보가 없습니다. FAIL_PAUSED 로 보류 처리합니다.`,
        );
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: "FAIL_PAUSED" },
        });
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

        await prisma.$transaction([
          prisma.order.create({
            data: {
              orderId,
              userId: sub.userId,
              orderName: `${sub.plan.name} 정기 결제`,
              amount: sub.plan.price,
              status: "PAID",
            },
          }),
          prisma.payment.create({
            data: {
              paymentKey: tossPayment.paymentKey,
              orderId,
              method: tossPayment.method ?? "카드",
              amount: sub.plan.price,
              status: "DONE",
              approvedAt: new Date(tossPayment.approvedAt),
              rawData: tossPayment as unknown as Prisma.InputJsonValue, // JSON safe cast
            },
          }),
          prisma.userSubscription.update({
            where: { id: sub.id },
            data: {
              startDate: sub.nextPaymentDate,
              endDate: nextPaymentDate,
              nextPaymentDate,
            },
          }),
        ]);

        this.logger.log(`구독 ID ${sub.id} 정기결제 성공!`);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "정기 자동 승인 거절";
        this.logger.error(`구독 ID ${sub.id} 정기결제 실패: ${errMsg}`);

        await prisma.$transaction([
          prisma.order.create({
            data: {
              orderId,
              userId: sub.userId,
              orderName: `${sub.plan.name} 정기 결제`,
              amount: sub.plan.price,
              status: "FAILED",
              failReason: errMsg,
            },
          }),
          prisma.userSubscription.update({
            where: { id: sub.id },
            data: { status: "FAIL_PAUSED" },
          }),
        ]);
      }
    }
  }

  /** 만료된 해지 구독 정리 배치 (스케줄러에서 자동 실행) */
  async processExpirations() {
    const today = new Date();
    // CANCELED 상태이며 만료일이 지난 구독을 EXPIRED 로 정리
    const expiredResult = await prisma.userSubscription.updateMany({
      where: {
        status: "CANCELED",
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
        `만료일이 도래한 해지 신청 구독 ${expiredResult.count}건을 EXPIRED 로 변경 완료했습니다.`,
      );
    }
  }
}
