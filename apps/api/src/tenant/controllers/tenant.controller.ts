import {
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
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ROLES } from "@pawlog/shared";
import { Public } from "../../shared/decorators/public.decorator";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import {
  CheckSubdomainAvailabilityDto,
  OnboardTenantDto,
  TenantDirectoryQueryDto,
  UpdateTenantActiveDto,
  UpdateTenantDto,
  UpdateTenantSettingsDto,
} from "../dtos";
import { TENANT_ROUTES } from "../routes";
import { TenantService } from "../services/tenant.service";

@ApiTags("Tenant")
@Controller(TENANT_ROUTES.v1.BASE)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ── 공개 (온보딩 부트스트랩) ──────────────────────────────────────
  // 주의: 아래 고정 경로 핸들러들은 반드시 ":id" 핸들러보다 먼저 선언되어야 한다.
  // Nest 는 선언 순서대로 매칭하므로, 순서가 바뀌면 "subdomain-availability" 가
  // GET ":id" 로 흡수된다.

  @Public()
  @Get(TENANT_ROUTES.v1.CHECK_SUBDOMAIN)
  @HttpCode(HttpStatus.OK)
  async checkSubdomainAvailability(
    @Query() query: CheckSubdomainAvailabilityDto,
  ) {
    return this.tenantService.checkSubdomainAvailability(query.subdomain);
  }

  // 보호자가 가입 신청할 매장 찾기 (공개).
  // job-059: 이름 검색과 지도 영역 검색을 함께 받는다.
  @Public()
  @Get(TENANT_ROUTES.v1.DIRECTORY)
  @HttpCode(HttpStatus.OK)
  async searchDirectory(@Query() query: TenantDirectoryQueryDto) {
    return this.tenantService.searchDirectory(query);
  }

  // ── 매장 설정 (job-059) — 원장이 자기 매장을 고친다 ────────────────
  // 대상은 활성 테넌트(X-Tenant-Id)라 id 를 받지 않는다. 고정 경로이므로 아래 ":id"
  // 핸들러들보다 **먼저** 선언되어야 한다.

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(TENANT_ROUTES.v1.SETTINGS)
  @HttpCode(HttpStatus.OK)
  async getSettings() {
    return this.tenantService.getSettings();
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Patch(TENANT_ROUTES.v1.SETTINGS)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("매장 정보가 저장되었습니다.")
  async updateSettings(@Body() dto: UpdateTenantSettingsDto) {
    return this.tenantService.updateSettings(dto);
  }

  // job-034: 매장 개설권(UserSubscription)을 보유한 로그인 회원만 호출할 수 있다.
  // @Roles 는 붙이지 않는다 — 아직 어떤 테넌트에도 속하지 않은 회원이 첫 매장을 여는 경로라
  // 실효 역할이 USER 이기 때문. 실제 제한은 서비스의 개설권 검사가 담당한다.
  @Post(TENANT_ROUTES.v1.ONBOARD)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("매장이 개설되었습니다.")
  async onboard(@Req() req: Request, @Body() dto: OnboardTenantDto) {
    return this.tenantService.onboard(req.user!.userId, dto);
  }

  // ── SUPER_ADMIN 전용 (플랫폼 운영) ────────────────────────────────
  // TENANT_ADMIN 은 자기 테넌트만 다루면 되므로 제외한다 — 다른 테넌트의 존재 자체가
  // 노출되면 안 되기 때문에 목록/상세까지 모두 SUPER_ADMIN 으로 제한한다.

  // 테넌트 목록 (페이지네이션·정렬·검색)
  @Roles(ROLES.SUPER_ADMIN)
  @Get(TENANT_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async listTenants(@Query() query: PaginationQueryDto) {
    return this.tenantService.listTenants(query);
  }

  // 서브도메인으로 테넌트 조회 (job-050) — apps/web 매장 게이트가 호출한다.
  // ⚠️ 반드시 아래 ":id" 핸들러보다 **먼저** 선언되어야 한다 (파일 상단 주석 참고).
  @Roles(ROLES.SUPER_ADMIN)
  @Get(TENANT_ROUTES.v1.GET_BY_SUBDOMAIN)
  @HttpCode(HttpStatus.OK)
  async getTenantBySubdomain(@Param("subdomain") subdomain: string) {
    return this.tenantService.getTenantBySubdomain(subdomain);
  }

  // 테넌트 상세
  @Roles(ROLES.SUPER_ADMIN)
  @Get(TENANT_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async getTenant(@Param("id") id: string) {
    return this.tenantService.getTenant(id);
  }

  // 테넌트 정보 수정 (이름·서브도메인)
  @Roles(ROLES.SUPER_ADMIN)
  @Patch(TENANT_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("테넌트 정보가 수정되었습니다.")
  async updateTenant(@Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.updateTenant(id, dto);
  }

  // 테넌트 활성/정지 토글
  @Roles(ROLES.SUPER_ADMIN)
  @Patch(TENANT_ROUTES.v1.UPDATE_ACTIVE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("테넌트 상태가 변경되었습니다.")
  async updateTenantActive(
    @Param("id") id: string,
    @Body() dto: UpdateTenantActiveDto,
  ) {
    return this.tenantService.setTenantActive(id, dto.isActive);
  }
}
