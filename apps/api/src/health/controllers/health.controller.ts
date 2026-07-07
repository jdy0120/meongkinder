import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";

import { Public } from "../../shared/decorators/public.decorator";
import { HEALTH_ROUTES } from "../routes";
import { HealthService } from "../services/health.service";

@Controller(HEALTH_ROUTES.BASE)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 헬스체크. 정상이면 200, DB/Redis 중 하나라도 죽으면 503 을 반환해
   * 로드밸런서/업타임 모니터가 비정상 인스턴스를 감지할 수 있게 한다.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    const result = await this.healthService.check();
    if (result.status !== "ok") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
