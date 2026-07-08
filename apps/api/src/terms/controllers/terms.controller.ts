import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { SubmitTermsAgreementDto } from "../dtos";
import { TERMS_ROUTES } from "../routes";
import { TermsService } from "../services/terms.service";

@ApiTags("Terms")
@Controller(TERMS_ROUTES.v1.BASE)
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  // 1. 활성화된 약관 목록 조회 (비로그인 공개)
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "활성화된 약관 목록 조회" })
  async listActiveTerms() {
    return this.termsService.listActiveTerms();
  }

  // 2. 약관 동의 제출
  @Post(TERMS_ROUTES.v1.AGREEMENTS)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "약관 동의 내역 추가 제출" })
  @ResponseMessage("약관 동의가 등록되었습니다.")
  async submitAgreements(
    @Req() req: Request,
    @Body() dto: SubmitTermsAgreementDto,
  ) {
    const userId = req.user?.userId || "";
    return this.termsService.submitAgreements(userId, dto);
  }
}
