import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { NotificationLogQueryDto } from "../dtos";
import { NOTIFICATION_ROUTES } from "../routes";
import { NotificationService } from "../services/notification.service";

// 알림 발송 내역 조회는 관리자 전용 업무이므로 TENANT_ADMIN/SUPER_ADMIN 만 접근 가능.
@ApiTags("NotificationLog")
@ApiBearerAuth()
@Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(NOTIFICATION_ROUTES.v1.BASE)
export class NotificationLogController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(NOTIFICATION_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: NotificationLogQueryDto) {
    return this.notificationService.findAll(query);
  }

  @Get(NOTIFICATION_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.notificationService.findOne(id);
  }
}
