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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import { CreateAttendanceDto, UpdateAttendanceDto } from "../dtos";
import { ATTENDANCE_ROUTES } from "../routes";
import { AttendanceService } from "../services/attendance.service";

// 출석(등/하원) 관리는 돌봄 스태프/관리자 전용 업무이므로 ADMIN 만 접근 가능.
@ApiTags("Attendance")
@ApiBearerAuth()
@Roles(ROLES.ADMIN)
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
