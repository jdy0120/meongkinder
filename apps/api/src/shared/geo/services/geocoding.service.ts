import { Injectable, Logger } from "@nestjs/common";

import { kakaoLocalConfig } from "../../configs/kakao-local.config";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** 카카오 로컬 주소검색 응답 중 실제로 쓰는 부분만. */
interface KakaoAddressSearchResponse {
  documents?: { x?: string; y?: string }[];
}

/**
 * 주소 → 좌표 (job-059).
 *
 * ## 왜 저장 시점에 변환하는가
 *
 * 조회할 때마다 변환하면 지도를 한 번 움직일 때마다 화면에 뜬 매장 수만큼 외부 API 를
 * 부르게 된다. 비용과 지연도 문제지만 더 나쁜 건 **카카오가 잠깐 느려지면 지도가 통째로
 * 빈다**는 것이다. 좌표는 주소가 바뀔 때만 바뀌므로 저장 시점에 확정하는 것이 맞다.
 *
 * ## 실패해도 예외를 던지지 않는다
 *
 * `ClaudeClientService` 와 같은 규약이다(CLAUDE.md §9). 지오코딩이 실패했다고 매장 정보
 * 저장을 통째로 실패시키면, 원장은 자기가 뭘 잘못했는지 알 수 없는 채로 주소를 못 넣는다.
 * **주소는 사람이 읽는 정보가 먼저이고 좌표는 지도에 얹기 위한 부가 정보**이므로, 좌표만
 * 비워 두고 저장을 진행한다. 그 매장은 목록에는 뜨고 지도에만 안 뜬다.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /** 주소 문자열의 좌표. 실패·미설정이면 `null`. */
  async geocode(address: string): Promise<Coordinates | null> {
    const query = address?.trim();
    if (!query) return null;

    if (!kakaoLocalConfig.isConfigured) {
      this.logger.warn(
        "KAKAO_REST_API_KEY(또는 KAKAO_CLIENT_ID)가 없어 지오코딩을 건너뜁니다. 주소만 저장됩니다.",
      );
      return null;
    }

    try {
      const url = `${kakaoLocalConfig.addressSearchUrl}?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${kakaoLocalConfig.restApiKey}` },
        signal: AbortSignal.timeout(kakaoLocalConfig.timeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(
          `카카오 주소검색 실패 (${response.status}). 좌표 없이 주소만 저장합니다.`,
        );
        return null;
      }

      const body = (await response.json()) as KakaoAddressSearchResponse;
      const top = body.documents?.[0];
      // 카카오는 경도를 x, 위도를 y 로 준다. 뒤집으면 매장이 바다 한가운데 찍힌다.
      const longitude = Number(top?.x);
      const latitude = Number(top?.y);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        this.logger.warn(
          `주소를 좌표로 바꾸지 못했습니다(검색 결과 없음). address=${query}`,
        );
        return null;
      }

      return { latitude, longitude };
    } catch (error) {
      // 타임아웃 포함. 저장 흐름을 막지 않는 것이 이 서비스의 계약이다.
      this.logger.warn(
        `지오코딩 중 오류가 발생해 좌표 없이 진행합니다: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
