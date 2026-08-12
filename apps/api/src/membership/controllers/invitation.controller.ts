import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import type { Request } from "express";

import { Public } from "../../shared/decorators/public.decorator";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  LookupInvitationDto,
} from "../dtos";
import { INVITATION_ROUTES } from "../routes";
import { InvitationService } from "../services/invitation.service";

@ApiTags("Invitation")
@Controller(INVITATION_ROUTES.v1.BASE)
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  // 고정 경로를 ":id" 보다 먼저 선언한다 (Nest 는 선언 순서로 매칭).

  // 초대 링크 미리보기 — 아직 가입하지 않은 사람도 열어봐야 하므로 공개.
  // 개인정보(이메일/전화번호)는 응답에 담지 않는다.
  @Public()
  @Get(INVITATION_ROUTES.v1.LOOKUP)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "초대 링크 미리보기 (공개)" })
  async lookup(@Query() query: LookupInvitationDto) {
    return this.invitationService.lookup(query.token);
  }

  // 로그인 회원이 토큰으로 직접 수락. 테넌트 컨텍스트가 필요 없다.
  @Post(INVITATION_ROUTES.v1.ACCEPT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "초대 수락" })
  @ResponseMessage("초대를 수락했습니다.")
  async accept(@Req() req: Request, @Body() dto: AcceptInvitationDto) {
    return this.invitationService.accept(req.user!.userId, dto.token);
  }

  // ── 테넌트 관리자 ──────────────────────────────────────────────────

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(INVITATION_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "구성원 초대 (미가입자는 연락처·아이 정보로 선등록)",
  })
  @ResponseMessage("초대가 생성되었습니다.")
  async create(@Req() req: Request, @Body() dto: CreateInvitationDto) {
    return this.invitationService.create(req.user!.userId, dto);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(INVITATION_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "초대 목록" })
  async list(@Query("status") status?: string) {
    return this.invitationService.list(status);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Delete(INVITATION_ROUTES.v1.CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "초대 취소" })
  @ResponseMessage("초대가 취소되었습니다.")
  async cancel(@Param("id") id: string) {
    return this.invitationService.cancel(id);
  }
}
