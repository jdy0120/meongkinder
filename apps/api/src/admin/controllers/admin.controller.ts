import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import {
  AdminCreatePetDto,
  PetIntakeDto,
  PetIntakeLookupDto,
  PetScheduleQueryDto,
  UpdatePetScheduleDto,
} from "../dtos";
import { ADMIN_ROUTES } from "../routes";
import {
  AdminService,
  DashboardService,
  PetIntakeService,
  PetScheduleService,
} from "../services";
import { TermsService } from "../../terms/services/terms.service";
import { CreateTermsDto, UpdateTermsActiveDto } from "../../terms/dtos";
import { UpdatePetDto } from "../../pet/dtos";

// 이 컨트롤러의 기본 접근 권한은 TENANT_ADMIN(테넌트 관리자)/SUPER_ADMIN(플랫폼 관리자)이다.
// USER/STAFF 토큰으로 호출하면 RolesGuard 가 403 을 반환한다.
//
// 단, 약관(terms) 핸들러는 아래에서 메서드 레벨 @Roles 로 SUPER_ADMIN 만 남긴다.
// 여기 있는 나머지 엔드포인트(회원·구독·펫)는 전부 requireTenantId() 와 멤버십 필터로
// 현재 테넌트 안으로 좁혀지지만, Terms 는 tenant_id 가 없는 플랫폼 공용 테이블이라
// 자동 스코프가 걸리지 않는다 — 클래스 기본값 그대로 두면 아무 매장의 TENANT_ADMIN 이
// 전 플랫폼 약관을 조회·등록·활성화할 수 있다.
@Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(ADMIN_ROUTES.v1.BASE)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly termsService: TermsService,
    private readonly petIntakeService: PetIntakeService,
    private readonly dashboardService: DashboardService,
    private readonly petScheduleService: PetScheduleService,
  ) {}

  /**
   * 매장 대시보드 (job-052, design-system.md §6.2).
   *
   * 다섯 블록을 한 응답으로 준다 — 화면이 블록마다 따로 부르면 우선순위가 **로딩 순서**로
   * 바뀌어(늦게 온 것이 늦게 뜬다) 순서를 정한 근거가 사라진다.
   *
   * STAFF 도 본다: 등원 현황과 주의할 아이는 현장에 서는 사람이 봐야 하는 정보다.
   */
  @Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(ADMIN_ROUTES.v1.DASHBOARD)
  @HttpCode(HttpStatus.OK)
  async getDashboard() {
    return this.dashboardService.getDashboard();
  }

  // 관리자 본인 확인 (admin 앱이 접근 권한 확인용으로 호출)
  @Get(ADMIN_ROUTES.v1.ME)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("관리자 인증 성공")
  me(@Req() req: Request) {
    return { user: req.user };
  }

  // 구독 목록 (페이지네이션·정렬·검색)
  @Get(ADMIN_ROUTES.v1.LIST_SUBSCRIPTIONS)
  @HttpCode(HttpStatus.OK)
  async listSubscriptions(@Query() query: PaginationQueryDto) {
    return this.adminService.listSubscriptions(query);
  }

  // ── 약관 (플랫폼 공용) ────────────────────────────────────────────────
  // Terms 는 테넌트에 매이지 않는 전 플랫폼 공용 문서다(terms.prisma 참고 — tenant_id 없음).
  // 따라서 매장 관리자가 아니라 플랫폼 운영자만 다룰 수 있어야 한다.
  // 메서드 레벨 @Roles 는 RolesGuard 의 getAllAndOverride([handler, class]) 에서
  // 클래스 레벨보다 우선하므로, 아래 네 개만 SUPER_ADMIN 으로 좁혀진다.

  // 모든 약관 버전 목록 조회 (플랫폼 운영자용)
  @Roles(ROLES.SUPER_ADMIN)
  @Get(ADMIN_ROUTES.v1.LIST_TERMS)
  @HttpCode(HttpStatus.OK)
  async listAllTerms() {
    return this.termsService.listAllTerms();
  }

  // 약관 상세 정보 조회 (로컬 파일 본문 포함)
  @Roles(ROLES.SUPER_ADMIN)
  @Get(ADMIN_ROUTES.v1.GET_TERMS)
  @HttpCode(HttpStatus.OK)
  async getTermsDetail(@Param("id") id: string) {
    return this.termsService.getTermsDetail(id);
  }

  // 새로운 약관 등록 (로컬 파일 저장 연동)
  @Roles(ROLES.SUPER_ADMIN)
  @Post(ADMIN_ROUTES.v1.CREATE_TERMS)
  @HttpCode(HttpStatus.CREATED)
  async createTerms(@Body() dto: CreateTermsDto) {
    return this.termsService.createTerms(dto);
  }

  // 약관 활성화 여부 토글
  @Roles(ROLES.SUPER_ADMIN)
  @Patch(ADMIN_ROUTES.v1.UPDATE_TERMS_ACTIVE)
  @HttpCode(HttpStatus.OK)
  async updateTermsActive(
    @Param("id") id: string,
    @Body() dto: UpdateTermsActiveDto,
  ) {
    return this.termsService.updateTermsActive(id, dto.isActive);
  }

  // 반려동물(원생) 목록 (전체 사용자 대상, 페이지네이션·정렬·검색)
  @Get(ADMIN_ROUTES.v1.LIST_PETS)
  @HttpCode(HttpStatus.OK)
  async listPets(@Query() query: PaginationQueryDto) {
    return this.adminService.listPets(query);
  }

  /**
   * 원생 목록 필터 칩의 개수 (job-052, design-system.md §6.1).
   *
   * 왜 목록 응답에서 세지 않는가: 목록은 페이지네이션이라 "이 페이지의 등원 중 3마리"만
   * 나온다. 필터 칩은 **매장 전체** 기준이어야 눌러 볼 가치가 있다.
   *
   * ⚠️ 고정 경로라 아래 "pets/:id" 보다 **먼저** 선언되어야 한다
   * (아니면 "pets/summary" 가 id="summary" 로 잡힌다).
   */
  @Get(ADMIN_ROUTES.v1.PET_SUMMARY)
  @HttpCode(HttpStatus.OK)
  async getPetSummary() {
    return this.adminService.getPetSummary();
  }

  /**
   * job-046: **원생 등록만 STAFF 에게 연다.**
   *
   * 처음 온 보호자를 맞고 아이 정보를 받아 적는 건 데스크(스태프) 업무다. 원장만 할 수 있게
   * 두면 원장이 자리에 없는 동안 신규 원생을 못 받고, 그 사이 출석·사진도 못 남긴다.
   * 회원 관리·이용권·약관 같은 경영 업무는 그대로 TENANT_ADMIN 전용이다.
   */
  @Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  // 원생 등록 단일 진입점 — 전화번호로 보호자와 등록 후보 아이를 조회 (job-040).
  // ⚠️ 고정 경로라 아래 "pets/:id" 보다 **먼저** 선언되어야 한다.
  @Get(ADMIN_ROUTES.v1.LOOKUP_PET_INTAKE)
  @HttpCode(HttpStatus.OK)
  async lookupPetIntake(@Query() query: PetIntakeLookupDto) {
    return this.petIntakeService.lookup(query.phone);
  }

  // 원생 등록 — 보호자의 가입 여부에 따라 서버가 분기한다 (job-040).
  // 미가입 보호자면 계정 없이 원생을 만들고 초대장을 남긴다. 알림톡은 그때부터 발송된다.
  @Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(ADMIN_ROUTES.v1.PET_INTAKE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("원생이 등록되었습니다.")
  async petIntake(@Req() req: Request, @Body() dto: PetIntakeDto) {
    return this.petIntakeService.intake(req.user?.userId || "", dto);
  }

  // 반려동물 상세 조회
  @Get(ADMIN_ROUTES.v1.GET_PET)
  @HttpCode(HttpStatus.OK)
  async getPet(@Param("id") id: string) {
    return this.adminService.getPet(id);
  }

  // 반려동물 등록 (보호자 지정)
  @Post(ADMIN_ROUTES.v1.CREATE_PET)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("반려동물이 등록되었습니다.")
  async createPet(@Body() dto: AdminCreatePetDto) {
    return this.adminService.createPet(dto);
  }

  // 반려동물 정보 수정 (견종·생일·체중·중성화·케어노트 등)
  @Patch(ADMIN_ROUTES.v1.UPDATE_PET)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("반려동물 정보가 수정되었습니다.")
  async updatePet(@Param("id") id: string, @Body() dto: UpdatePetDto) {
    return this.adminService.updatePet(id, dto);
  }

  /**
   * 등원 스케줄 조회 (job-053).
   *
   * WEEKLY 아이도 그 달의 날짜를 계산해 함께 내려준다 — 달력 화면이 방식에 따라 다른
   * 모양을 그리지 않아도 되고, 원장은 "매주 화·목"이 이번 달 며칠인지 세지 않아도 된다.
   */
  @Get(ADMIN_ROUTES.v1.GET_PET_SCHEDULE)
  @HttpCode(HttpStatus.OK)
  async getPetSchedule(
    @Param("id") id: string,
    @Query() query: PetScheduleQueryDto,
  ) {
    return this.petScheduleService.list(id, query.month);
  }

  /**
   * 등원 스케줄 저장 (job-053).
   *
   * PATCH 가 아니라 PUT 인 이유: MONTHLY 저장은 그 달을 **통째로 교체**한다(체크를 푼
   * 날짜는 빠져야 하는데, 부분 수정 의미로 읽히면 "빈 배열 = 안 보냄"과 구분되지 않는다).
   *
   * ⚠️ 권한은 클래스 기본값(TENANT_ADMIN)을 그대로 쓴다. 처음에는 "일정 조정은 데스크
   * 업무"라는 이유로 STAFF 에게 열었는데, **이 화면에 도달하는 경로가 원생 목록
   * (`GET pets`, TENANT_ADMIN 전용)뿐**이라 STAFF 는 저장 권한만 있고 그 버튼을 볼 수가
   * 없었다 — 실현되지 않는 권한은 권한 설계를 실제보다 넓어 보이게 만들 뿐이다.
   * STAFF 에게 열려면 원생 목록부터 함께 열어야 하고, 그건 파트타임 선생님에게 보호자
   * 연락처 전체를 여는 결정이라 별도 판단이 필요하다.
   */
  @Put(ADMIN_ROUTES.v1.UPDATE_PET_SCHEDULE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("등원 스케줄이 저장되었습니다.")
  async updatePetSchedule(
    @Param("id") id: string,
    @Body() dto: UpdatePetScheduleDto,
  ) {
    return this.petScheduleService.update(id, dto);
  }
}
