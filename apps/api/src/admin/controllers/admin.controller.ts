import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ROLES } from "@template/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import { UpdateUserRoleDto } from "../dtos";
import { ADMIN_ROUTES } from "../routes";
import { AdminService } from "../services";

// 이 컨트롤러의 모든 엔드포인트는 ADMIN 역할만 접근 가능.
// USER 토큰으로 호출하면 RolesGuard 가 403 을 반환한다.
@Roles(ROLES.ADMIN)
@Controller(ADMIN_ROUTES.v1.BASE)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 관리자 본인 확인 (admin 앱이 접근 권한 확인용으로 호출)
  @Get(ADMIN_ROUTES.v1.ME)
  @HttpCode(HttpStatus.OK)
  me(@Req() req: Request) {
    return {
      message: "관리자 인증 성공",
      user: req.user,
    };
  }

  // 사용자 목록 (페이지네이션·정렬·검색)
  @Get(ADMIN_ROUTES.v1.LIST_USERS)
  @HttpCode(HttpStatus.OK)
  async listUsers(@Query() query: PaginationQueryDto) {
    return this.adminService.listUsers(query);
  }

  // 사용자 역할 변경 (승격/강등)
  @Patch(ADMIN_ROUTES.v1.UPDATE_USER_ROLE)
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    // 실수로 마지막 관리자가 스스로를 강등해 잠기는 것을 방지
    if (id === req.user?.userId) {
      throw new BadRequestException("본인의 역할은 변경할 수 없습니다.");
    }
    return this.adminService.updateUserRole(id, dto.role);
  }

  // 구독 목록 (페이지네이션·정렬·검색)
  @Get(ADMIN_ROUTES.v1.LIST_SUBSCRIPTIONS)
  @HttpCode(HttpStatus.OK)
  async listSubscriptions(@Query() query: PaginationQueryDto) {
    return this.adminService.listSubscriptions(query);
  }
}
