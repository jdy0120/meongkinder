import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "@template/database";
import * as crypto from "crypto";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@template/shared";
import { tossAuthHeader, tossConfig } from "../../shared/configs/toss.config";
import { ResponseEnvelope } from "../../shared/dtos";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants";
import { CancelPaymentDto, ConfirmPaymentDto, CreateOrderDto } from "../dtos";

// 정렬 허용 필드 (임의 필드 주입 방지)
const ORDER_SORTABLE_FIELDS = ["createdAt", "amount", "status"] as const;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  /** 토스 API 공통 호출 헬퍼 (Basic 인증 + JSON) */
  private async tossRequest<T = any>(
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 토스 에러 응답: { code, message }
      this.logger.warn(
        `토스 API 오류 ${res.status}: ${data?.code} ${data?.message}`,
      );
      throw new BadRequestException(
        data?.message || "결제 처리 중 오류가 발생했습니다.",
      );
    }
    return data as T;
  }

  /** 1) 주문 생성 — 클라이언트가 결제창을 띄우기 전에 호출 */
  async createOrder(userId: string, dto: CreateOrderDto) {
    const orderId = `order_${crypto.randomUUID().replace(/-/g, "")}`;

    const order = await prisma.order.create({
      data: {
        orderId,
        userId,
        orderName: dto.orderName,
        amount: dto.amount,
        status: ORDER_STATUS.PENDING,
      },
    });

    return {
      orderId: order.orderId,
      orderName: order.orderName,
      amount: order.amount,
    };
  }

  /** 내 주문 목록 (공통 페이지네이션 유틸 사용) */
  async listOrders(userId: string, query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      userId,
      // orderName 부분 검색 (대소문자 무시)
      ...(search
        ? { orderName: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const sortField = ORDER_SORTABLE_FIELDS.includes(
      sort as (typeof ORDER_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: { payment: true },
      }),
      prisma.order.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 2) 결제 승인 — 결제창 성공 리다이렉트 후 클라이언트가 호출.
   * ⚠️ 금액은 반드시 서버에 저장된 주문 금액과 대조한다 (위변조 방지).
   */
  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    const order = await prisma.order.findUnique({
      where: { orderId: dto.orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException("존재하지 않는 주문입니다.");
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("본인의 주문이 아닙니다.");
    }

    // 멱등성: 이미 승인된 주문이면 기존 결과 반환
    if (order.status === ORDER_STATUS.PAID && order.payment) {
      return this.toPaymentSummary(order.payment, "이미 승인된 결제입니다.");
    }

    // 🔒 금액 위변조 검증: 클라이언트가 보낸 금액과 주문 금액이 일치해야 함
    if (order.amount !== dto.amount) {
      throw new BadRequestException(
        "결제 금액이 주문 금액과 일치하지 않습니다.",
      );
    }

    // 토스 결제 승인
    const tossPayment = await this.tossRequest("/payments/confirm", {
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    });

    // 결제 저장 + 주문 상태 갱신 (트랜잭션)
    const [payment] = await prisma.$transaction([
      prisma.payment.upsert({
        where: { orderId: order.orderId },
        create: {
          paymentKey: tossPayment.paymentKey,
          orderId: order.orderId,
          method: tossPayment.method ?? null,
          amount: tossPayment.totalAmount ?? dto.amount,
          status: tossPayment.status ?? PAYMENT_STATUS.DONE,
          approvedAt: tossPayment.approvedAt
            ? new Date(tossPayment.approvedAt)
            : null,
          rawData: tossPayment,
        },
        update: {
          paymentKey: tossPayment.paymentKey,
          method: tossPayment.method ?? null,
          amount: tossPayment.totalAmount ?? dto.amount,
          status: tossPayment.status ?? PAYMENT_STATUS.DONE,
          approvedAt: tossPayment.approvedAt
            ? new Date(tossPayment.approvedAt)
            : null,
          rawData: tossPayment,
        },
      }),
      prisma.order.update({
        where: { orderId: order.orderId },
        data: { status: ORDER_STATUS.PAID },
      }),
    ]);

    return this.toPaymentSummary(payment, "결제가 완료되었습니다.");
  }

  /** 3) 결제 취소 / 환불 (전액 또는 부분) */
  async cancelPayment(
    userId: string,
    paymentKey: string,
    dto: CancelPaymentDto,
  ) {
    const payment = await prisma.payment.findUnique({
      where: { paymentKey },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException("존재하지 않는 결제입니다.");
    }
    if (payment.order.userId !== userId) {
      throw new ForbiddenException("본인의 결제가 아닙니다.");
    }

    const tossPayment = await this.tossRequest(
      `/payments/${paymentKey}/cancel`,
      {
        cancelReason: dto.cancelReason,
        ...(dto.cancelAmount ? { cancelAmount: dto.cancelAmount } : {}),
      },
    );

    const isFullCancel = tossPayment.status === PAYMENT_STATUS.CANCELED;

    await prisma.$transaction([
      prisma.payment.update({
        where: { paymentKey },
        data: { status: tossPayment.status, rawData: tossPayment },
      }),
      prisma.order.update({
        where: { orderId: payment.orderId },
        data: {
          status: isFullCancel ? ORDER_STATUS.CANCELED : ORDER_STATUS.PAID,
        },
      }),
    ]);

    return new ResponseEnvelope(
      { paymentKey, status: tossPayment.status },
      isFullCancel ? "결제가 취소되었습니다." : "부분 취소되었습니다.",
    );
  }

  /**
   * 4) 웹훅 — 토스가 결제 상태 변화를 통지 (가상계좌 입금 등).
   * 웹훅 본문을 신뢰하지 않고, paymentKey 로 토스에 재조회해 상태를 동기화한다.
   */
  async handleWebhook(body: any) {
    const paymentKey: string | undefined =
      body?.data?.paymentKey ?? body?.paymentKey;
    const orderId: string | undefined = body?.data?.orderId ?? body?.orderId;

    if (!paymentKey && !orderId) {
      // 알 수 없는 이벤트는 200 으로 흘려보냄 (토스 재시도 방지)
      this.logger.warn(`알 수 없는 웹훅 페이로드: ${JSON.stringify(body)}`);
      return { received: true };
    }

    // 없는 결제(승인 전 단계 등)면 조용히 무시
    const existing = paymentKey
      ? await prisma.payment.findUnique({ where: { paymentKey } })
      : await prisma.payment.findUnique({ where: { orderId: orderId! } });
    if (!existing) return { received: true };

    // 토스에 재조회해 진짜 상태를 반영
    const key = paymentKey ?? existing.paymentKey;
    const verified = await this.tossRequest(`/payments/${key}`);

    const isCanceled =
      verified.status === PAYMENT_STATUS.CANCELED ||
      verified.status === PAYMENT_STATUS.PARTIAL_CANCELED;
    const isDone = verified.status === PAYMENT_STATUS.DONE;

    await prisma.$transaction([
      prisma.payment.update({
        where: { paymentKey: verified.paymentKey },
        data: {
          status: verified.status,
          method: verified.method ?? existing.method,
          approvedAt: verified.approvedAt
            ? new Date(verified.approvedAt)
            : existing.approvedAt,
          rawData: verified,
        },
      }),
      prisma.order.update({
        where: { orderId: verified.orderId },
        data: {
          status: isCanceled
            ? verified.status === PAYMENT_STATUS.CANCELED
              ? ORDER_STATUS.CANCELED
              : ORDER_STATUS.PAID
            : isDone
              ? ORDER_STATUS.PAID
              : undefined,
        },
      }),
    ]);

    return { received: true };
  }

  /** 5) 주문 조회 */
  async getOrder(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { payment: true },
    });
    if (!order) {
      throw new NotFoundException("존재하지 않는 주문입니다.");
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("본인의 주문이 아닙니다.");
    }
    return { order };
  }

  private toPaymentSummary(
    payment: { paymentKey: string; amount: number; status: string },
    message: string,
  ) {
    return new ResponseEnvelope(
      {
        paymentKey: payment.paymentKey,
        amount: payment.amount,
        status: payment.status,
      },
      message,
    );
  }
}
