import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ROLES } from "@template/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import { UpdateUserDto, UpdateUserRoleDto } from "../dtos";
import { ADMIN_ROUTES } from "../routes";
import { AdminService } from "../services";
import { TermsService } from "../../terms/services/terms.service";
import { CreateTermsDto, UpdateTermsActiveDto } from "../../terms/dtos";

// 이 컨트롤러의 모든 엔드포인트는 ADMIN 역할만 접근 가능.
// USER 토큰으로 호출하면 RolesGuard 가 403 을 반환한다.
@Roles(ROLES.ADMIN)
@Controller(ADMIN_ROUTES.v1.BASE)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly termsService: TermsService,
  ) {}

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

  // 사용자 정보 수정 (닉네임·계정 상태)
  @Patch(ADMIN_ROUTES.v1.UPDATE_USER)
  @HttpCode(HttpStatus.OK)
  async updateUser(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
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

  // 모든 약관 버전 목록 조회 (어드민용)
  @Get(ADMIN_ROUTES.v1.LIST_TERMS)
  @HttpCode(HttpStatus.OK)
  async listAllTerms() {
    return this.termsService.listAllTerms();
  }

  // 약관 상세 정보 조회 (로컬 파일 본문 포함)
  @Get(ADMIN_ROUTES.v1.GET_TERMS)
  @HttpCode(HttpStatus.OK)
  async getTermsDetail(@Param("id") id: string) {
    return this.termsService.getTermsDetail(id);
  }

  // 새로운 약관 등록 (로컬 파일 저장 연동)
  @Post(ADMIN_ROUTES.v1.CREATE_TERMS)
  @HttpCode(HttpStatus.CREATED)
  async createTerms(@Body() dto: CreateTermsDto) {
    return this.termsService.createTerms(dto);
  }

  // 약관 활성화 여부 토글
  @Patch(ADMIN_ROUTES.v1.UPDATE_TERMS_ACTIVE)
  @HttpCode(HttpStatus.OK)
  async updateTermsActive(
    @Param("id") id: string,
    @Body() dto: UpdateTermsActiveDto,
  ) {
    return this.termsService.updateTermsActive(id, dto.isActive);
  }
}
