import { Global, Module } from "@nestjs/common";

import { GeocodingService } from "./services/geocoding.service";

/**
 * 위치 관련 모듈 (job-059).
 *
 * 주소를 저장하는 곳이 둘(매장 개설 · 매장 설정)이고 앞으로도 늘 수 있어, LlmModule 과
 * 같은 자리에 @Global 로 열어 둔다.
 */
@Global()
@Module({
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeoModule {}
