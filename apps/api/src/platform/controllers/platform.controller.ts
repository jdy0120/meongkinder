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
  CreatePlatformUserDto,
  ListPlatformUsersQueryDto,
  ListSeatSubscriptionsQueryDto,
  UpdatePlatformUserRoleDto,
  UpdatePlatformUserStatusDto,
} from "../dtos";
import { PLATFORM_ROUTES } from "../routes";
import { PlatformService } from "../services/platform.service";

/**
 * 플랫폼 운영 (job-037) — 전부 SUPER_ADMIN 전용.
 *
 * `v1/admin/*` 은 **한 매장** 관리(TENANT_ADMIN)이고, 여기는 **전 플랫폼** 관리다.
 * 클래스 레벨 `@Roles(SUPER_ADMIN)` 로 통째로 잠근다.
 */
@ApiTags("Platform")
@Roles(ROLES.SUPER_ADMIN)
@Controller(PLATFORM_ROUTES.v1.BASE)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // 고정 경로가 ":id" 보다 먼저 선언되어야 한다 (Nest 는 선언 순서로 매칭).

  @Get(PLATFORM_ROUTES.v1.LIST_SEAT_SUBSCRIPTIONS)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "전 플랫폼 매장 개설권 구독 현황" })
  async listSeatSubscriptions(@Query() query: ListSeatSubscriptionsQueryDto) {
    return this.platformService.listSeatSubscriptions(query);
  }

  @Get(PLATFORM_ROUTES.v1.LIST_USERS)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "전 플랫폼 회원 목록" })
  async listUsers(@Query() query: ListPlatformUsersQueryDto) {
    return this.platformService.listUsers(query);
  }

  @Post(PLATFORM_ROUTES.v1.CREATE_USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "계정 발급",
    description:
      "약관 동의는 받지 않는다 — 본인이 처음 apps/web 에 들어올 때 최초 진입 게이트가 받는다.",
  })
  @ResponseMessage("계정이 발급되었습니다.")
  async createUser(@Body() dto: CreatePlatformUserDto) {
    return this.platformService.createUser(dto);
  }

  @Get(PLATFORM_ROUTES.v1.GET_USER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "회원 상세 (소속 이력 + 보유 개설권)" })
  async getUser(@Param("id") id: string) {
    return this.platformService.getUser(id);
  }

  @Patch(PLATFORM_ROUTES.v1.UPDATE_USER_STATUS)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "계정 정지/해제" })
  @ResponseMessage("계정 상태가 변경되었습니다.")
  async updateUserStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdatePlatformUserStatusDto,
  ) {
    return this.platformService.updateUserStatus(
      req.user!.userId,
      id,
      dto.status,
    );
  }

  @Patch(PLATFORM_ROUTES.v1.UPDATE_USER_ROLE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "SUPER_ADMIN 승격/강등" })
  @ResponseMessage("플랫폼 역할이 변경되었습니다.")
  async updateUserRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdatePlatformUserRoleDto,
  ) {
    return this.platformService.updateUserRole(req.user!.userId, id, dto.role);
  }

  @Delete(PLATFORM_ROUTES.v1.DELETE_USER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "계정 삭제 (펫·소속 함께 삭제됨)" })
  @ResponseMessage("계정이 삭제되었습니다.")
  async deleteUser(@Req() req: Request, @Param("id") id: string) {
    return this.platformService.deleteUser(req.user!.userId, id);
  }
}
