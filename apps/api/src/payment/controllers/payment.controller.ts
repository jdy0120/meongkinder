import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import { PAYMENT_ROUTES } from "../routes";
import { PaymentService } from "../services";
import { CancelPaymentDto, ConfirmPaymentDto, CreateOrderDto } from "../dtos";

@Controller(PAYMENT_ROUTES.v1.BASE)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // 주문 생성 (결제창 호출 전)
  @Post(PAYMENT_ROUTES.v1.CREATE_ORDER)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("주문이 생성되었습니다.")
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const userId = req.user?.userId || "";
    return this.paymentService.createOrder(userId, dto);
  }

  // 내 주문 목록 (페이지네이션·정렬·검색)
  @Get(PAYMENT_ROUTES.v1.LIST_ORDERS)
  @HttpCode(HttpStatus.OK)
  async listOrders(@Req() req: Request, @Query() query: PaginationQueryDto) {
    const userId = req.user?.userId || "";
    return this.paymentService.listOrders(userId, query);
  }

  // 결제 승인 (성공 리다이렉트 후)
  @Post(PAYMENT_ROUTES.v1.CONFIRM)
  @HttpCode(HttpStatus.OK)
  async confirm(@Req() req: Request, @Body() dto: ConfirmPaymentDto) {
    const userId = req.user?.userId || "";
    return this.paymentService.confirmPayment(userId, dto);
  }

  // 결제 취소 / 환불
  @Post(PAYMENT_ROUTES.v1.CANCEL)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Req() req: Request,
    @Param("paymentKey") paymentKey: string,
    @Body() dto: CancelPaymentDto,
  ) {
    const userId = req.user?.userId || "";
    return this.paymentService.cancelPayment(userId, paymentKey, dto);
  }

  // 토스 웹훅 (서버-서버 호출이라 인증 쿠키가 없으므로 공개)
  @Public()
  @Post(PAYMENT_ROUTES.v1.WEBHOOK)
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: Record<string, unknown>) {
    return this.paymentService.handleWebhook(body);
  }

  // 주문 조회
  @Get(PAYMENT_ROUTES.v1.GET_ORDER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("주문 조회 성공")
  async getOrder(@Req() req: Request, @Param("orderId") orderId: string) {
    const userId = req.user?.userId || "";
    return this.paymentService.getOrder(userId, orderId);
  }
}
