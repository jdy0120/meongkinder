import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import type { Request } from "express";

import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import {
  ApplyMembershipDto,
  DecideMembershipDto,
  ListMembershipsQueryDto,
  UpdateMembershipRoleDto,
} from "../dtos";
import { MEMBERSHIP_ROUTES } from "../routes";
import { MembershipService } from "../services/membership.service";

@ApiTags("Membership")
@Controller(MEMBERSHIP_ROUTES.v1.BASE)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // ── 회원 본인 ──────────────────────────────────────────────────────
  // 테넌트 컨텍스트가 필요 없다(교차 테넌트 조회). @Roles 를 붙이면 활성 테넌트가 없을 때
  // 실효 역할이 USER 라 막히므로 붙이지 않는다 — 인증만 요구한다.
  // 주의: 고정 경로가 ":id" 계열보다 먼저 선언되어야 한다.

  @Get(MEMBERSHIP_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "내가 속한/신청한 매장 목록" })
  async listMine(@Req() req: Request) {
    return this.membershipService.listMine(req.user!.userId);
  }

  @Post(MEMBERSHIP_ROUTES.v1.APPLY)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "보호자로 매장 가입 신청" })
  @ResponseMessage("가입 신청이 접수되었습니다. 관리자 승인을 기다려주세요.")
  async apply(@Req() req: Request, @Body() dto: ApplyMembershipDto) {
    return this.membershipService.apply(req.user!.userId, dto.tenantId);
  }

  @Post(MEMBERSHIP_ROUTES.v1.LEAVE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "매장 소속 탈퇴" })
  @ResponseMessage("소속이 해제되었습니다.")
  async leave(@Req() req: Request, @Param("id") id: string) {
    return this.membershipService.leave(req.user!.userId, id);
  }

  // ── 테넌트 관리자 ──────────────────────────────────────────────────

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(MEMBERSHIP_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구성원 목록 (승인 대기 포함)" })
  async list(@Query() query: ListMembershipsQueryDto) {
    return this.membershipService.list(query);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Patch(MEMBERSHIP_ROUTES.v1.DECIDE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "가입 신청 승인/반려" })
  @ResponseMessage("신청이 처리되었습니다.")
  async decide(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: DecideMembershipDto,
  ) {
    return this.membershipService.decide(req.user!.userId, id, dto.status);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Patch(MEMBERSHIP_ROUTES.v1.UPDATE_ROLE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구성원 역할 변경" })
  @ResponseMessage("역할이 변경되었습니다.")
  async updateRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateMembershipRoleDto,
  ) {
    return this.membershipService.updateRole(req.user!.userId, id, dto.role);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Delete(MEMBERSHIP_ROUTES.v1.REMOVE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구성원 내보내기" })
  @ResponseMessage("구성원을 내보냈습니다.")
  async remove(@Req() req: Request, @Param("id") id: string) {
    return this.membershipService.remove(req.user!.userId, id);
  }
}
