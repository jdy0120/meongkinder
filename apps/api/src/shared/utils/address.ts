import type { TenantAddressInput } from "@pawlog/shared";

import type { GeocodingService } from "../geo/services/geocoding.service";

/** 매장 주소 저장에 쓰이는 Prisma data 조각. */
export interface TenantAddressData {
  postalCode?: string | null;
  roadAddress?: string | null;
  addressDetail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BuiltAddress {
  data: TenantAddressData;
  /** 주소는 들어왔는데 좌표를 못 얻은 경우. 화면이 "지도에 안 뜬다"를 말해줘야 한다. */
  geocodeFailed: boolean;
}

const trimmed = (value?: string) => value?.trim() ?? undefined;

/**
 * 주소 입력을 저장 가능한 형태로 바꾼다 (job-059).
 *
 * 매장 개설과 매장 설정 **두 곳이 같은 규칙을 써야** 하므로 여기 하나로 모은다. 각자
 * 구현하면 한쪽만 지오코딩하거나, 한쪽만 주소를 지울 때 좌표를 남기는 일이 생긴다.
 *
 * 규칙 세 가지:
 *
 *   1. `roadAddress` 를 **보내지 않았으면** 좌표를 건드리지 않는다. 부분 수정에서
 *      상세주소만 바꿨는데 좌표가 날아가면 안 된다.
 *   2. `roadAddress` 를 **빈 값으로 보냈으면** 주소를 지운 것이므로 좌표도 함께 지운다.
 *      주소 없는 좌표가 남으면 지도에는 뜨는데 눌러도 주소가 없는 핀이 된다.
 *   3. 지오코딩에는 **도로명 주소만** 넘긴다. 상세주소(층/호)를 붙이면 검색 정확도가
 *      오히려 떨어진다 — 카카오는 건물까지만 안다.
 */
export const buildAddressData = async (
  geocoding: GeocodingService,
  input: TenantAddressInput,
): Promise<BuiltAddress> => {
  const postalCode = trimmed(input.postalCode);
  const roadAddress = trimmed(input.roadAddress);
  const addressDetail = trimmed(input.addressDetail);

  const data: TenantAddressData = {};

  if (input.postalCode !== undefined) data.postalCode = postalCode || null;
  if (input.addressDetail !== undefined) {
    data.addressDetail = addressDetail || null;
  }

  // ① 도로명 주소를 안 보냈다 → 좌표는 그대로 둔다.
  if (input.roadAddress === undefined) {
    return { data, geocodeFailed: false };
  }

  // ② 주소를 지웠다 → 좌표도 같이 지운다.
  if (!roadAddress) {
    return {
      data: { ...data, roadAddress: null, latitude: null, longitude: null },
      geocodeFailed: false,
    };
  }

  // ③ 주소가 들어왔다 → 지금 좌표를 확정한다. 실패해도 주소는 저장한다.
  const coordinates = await geocoding.geocode(roadAddress);

  return {
    data: {
      ...data,
      roadAddress,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    },
    geocodeFailed: coordinates === null,
  };
};
