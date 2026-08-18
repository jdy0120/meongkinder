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
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import {
  CreatePetDto,
  CreateReservationDto,
  EnrollPetDto,
  ReservationCalendarQueryDto,
  UpdatePetDto,
} from "../dtos";
import { PET_ROUTES } from "../routes";
import { PetReservationService } from "../services/pet-reservation.service";
import { PetService } from "../services/pet.service";

@ApiTags("Pet")
@ApiBearerAuth()
@Controller(PET_ROUTES.v1.BASE)
export class PetController {
  constructor(
    private readonly petService: PetService,
    private readonly reservationService: PetReservationService,
  ) {}

  @Post(PET_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("반려동물이 등록되었습니다.")
  async create(@Req() req: Request, @Body() dto: CreatePetDto) {
    const userId = req.user?.userId || "";
    return this.petService.create(userId, dto);
  }

  @Get(PET_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: Request, @Query() query: PaginationQueryDto) {
    const userId = req.user?.userId || "";
    return this.petService.findAllByUser(userId, query);
  }

  @Get(PET_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Req() req: Request, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.petService.findOne(userId, id);
  }

  @Patch(PET_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("반려동물 정보가 수정되었습니다.")
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdatePetDto,
  ) {
    const userId = req.user?.userId || "";
    return this.petService.update(userId, id, dto);
  }

  @Delete(PET_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("반려동물이 삭제되었습니다.")
  async remove(@Req() req: Request, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.petService.remove(userId, id);
  }

  // job-033: 펫 소유와 매장 소속은 별개다. 등원은 ACTIVE 구성원인 매장에만 가능하다.
  @Post(PET_ROUTES.v1.ENROLL)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("아이가 매장에 등록되었습니다.")
  async enroll(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: EnrollPetDto,
  ) {
    const userId = req.user?.userId || "";
    return this.petService.enroll(userId, id, dto.tenantId);
  }

  @Post(PET_ROUTES.v1.UNENROLL)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("등원이 해지되었습니다.")
  async unenroll(@Req() req: Request, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.petService.unenroll(userId, id);
  }

  // ── 등원 예약 (job-060) ────────────────────────────────────────────────
  //
  // `@Roles` 를 붙이지 않는다. 보호자는 개인 스코프(활성 테넌트 없음)에서 부르므로
  // 실효 역할이 `USER` 이고, 테넌트 역할을 요구하면 그 순간 전부 403 이 된다
  // (CLAUDE.md §5). 실제 제한은 서비스의 소유 검사(`pet.userId = 나`)가 담당한다.

  @Get(PET_ROUTES.v1.RESERVATIONS)
  @HttpCode(HttpStatus.OK)
  async reservationCalendar(
    @Req() req: Request,
    @Param("id") id: string,
    @Query() query: ReservationCalendarQueryDto,
  ) {
    const userId = req.user?.userId || "";
    return this.reservationService.calendar(userId, id, query.month);
  }

  @Post(PET_ROUTES.v1.RESERVATIONS)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("등원 예약이 완료되었습니다.")
  async createReservation(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: CreateReservationDto,
  ) {
    const userId = req.user?.userId || "";
    return this.reservationService.create(userId, id, dto);
  }

  @Delete(PET_ROUTES.v1.CANCEL_RESERVATION)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("등원 예약이 취소되었습니다.")
  async cancelReservation(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("date") date: string,
  ) {
    const userId = req.user?.userId || "";
    return this.reservationService.cancel(userId, id, date);
  }
}
