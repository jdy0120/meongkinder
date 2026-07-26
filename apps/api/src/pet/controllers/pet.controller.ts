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
import { CreatePetDto, UpdatePetDto } from "../dtos";
import { PET_ROUTES } from "../routes";
import { PetService } from "../services/pet.service";

@ApiTags("Pet")
@ApiBearerAuth()
@Controller(PET_ROUTES.v1.BASE)
export class PetController {
  constructor(private readonly petService: PetService) {}

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
}
