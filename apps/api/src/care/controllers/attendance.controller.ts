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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import {
  AttendanceQueryDto,
  CheckInAttendanceDto,
  CheckOutAttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  UpdateAttendanceStatusDto,
} from "../dtos";
import { ATTENDANCE_ROUTES } from "../routes";
import { AttendanceService } from "../services/attendance.service";

// 출석(등/하원) 관리는 돌봄 스태프/관리자 전용 업무이므로 STAFF/TENANT_ADMIN/SUPER_ADMIN 만 접근 가능.
@ApiTags("Attendance")
@ApiBearerAuth()
@Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(ATTENDANCE_ROUTES.v1.BASE)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post(ATTENDANCE_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("출석 기록이 등록되었습니다.")
  async create(@Body() dto: CreateAttendanceDto) {
    return this.attendanceService.create(dto);
  }

  @Get(ATTENDANCE_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query("petId") petId?: string,
  ) {
    return this.attendanceService.findAll({ ...query, petId });
  }

  // 오늘의 출석부 (요일 스케줄 기반 자동 생성 + 페이지네이션). ":id" 라우트보다 먼저 매칭되어야 함.
  /**
   * 보호자 - 내 아이 등원 이력 (job-046).
   * 매장 운영 권한이 아니라 "내 아이인가"로 판정하므로 클래스 레벨 @Roles 를 덮는다.
   */
  @Roles()
  @Get(ATTENDANCE_ROUTES.v1.MY_LIST)
  @HttpCode(HttpStatus.OK)
  async findMine(@Req() req: Request, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAllForOwner(
      req.user?.userId || "",
      query,
    );
  }

  @Get(ATTENDANCE_ROUTES.v1.TODAY)
  @HttpCode(HttpStatus.OK)
  async findToday(@Query() query: PaginationQueryDto) {
    return this.attendanceService.findToday(query);
  }

  @Post(ATTENDANCE_ROUTES.v1.CHECK_IN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("등원 처리되었습니다.")
  async checkIn(@Param("id") id: string, @Body() dto: CheckInAttendanceDto) {
    return this.attendanceService.checkIn(id, dto);
  }

  /**
   * 등원 되돌리기 (job-052). 상태뿐 아니라 **이용권 차감까지** 되돌린다.
   * 이미 나간 알림톡은 회수할 수 없어 `guardianNotified: true` 로 그 사실을 함께 돌려준다.
   */
  @Post(ATTENDANCE_ROUTES.v1.UNDO_CHECK_IN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("등원 처리를 되돌렸습니다.")
  async undoCheckIn(@Param("id") id: string) {
    return this.attendanceService.undoCheckIn(id);
  }

  @Post(ATTENDANCE_ROUTES.v1.CHECK_OUT)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("하원 처리되었습니다.")
  async checkOut(@Param("id") id: string, @Body() dto: CheckOutAttendanceDto) {
    return this.attendanceService.checkOut(id, dto);
  }

  @Patch(ATTENDANCE_ROUTES.v1.STATUS)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("출석 상태가 처리되었습니다.")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAttendanceStatusDto,
  ) {
    return this.attendanceService.updateStatus(id, dto);
  }

  @Get(ATTENDANCE_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(ATTENDANCE_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("출석 기록이 수정되었습니다.")
  async update(@Param("id") id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, dto);
  }

  @Delete(ATTENDANCE_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("출석 기록이 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.attendanceService.remove(id);
  }
}
