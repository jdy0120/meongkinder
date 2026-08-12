-- job-059: 매장 위치 (지도 기반 매장 찾기).
--
-- 보호자가 매장을 찾는 방법이 **이름 검색** 하나뿐이었다 — 즉 이미 아는 매장만 찾을 수
-- 있었다. 지도로 찾으려면 좌표가 필요하고, 좌표는 주소에서 나온다.
--
-- 전부 NULL 허용이다. 이미 개설된 매장이 주소 없이 존재하고, 주소를 넣지 않은 매장도
-- 목록·운영에는 아무 문제가 없어야 한다(지도에만 안 뜬다).
ALTER TABLE "tenants" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "tenants" ADD COLUMN "road_address" TEXT;

-- 상세주소(층/호)는 공개 디렉터리에 싣지 않는다. 지도 핀에는 도로명까지면 충분하고,
-- 소규모 매장은 주소가 곧 자택인 경우가 있어 공개 범위를 좁게 잡는다.
ALTER TABLE "tenants" ADD COLUMN "address_detail" TEXT;

-- 좌표는 주소를 저장하는 시점에 지오코딩해서 함께 넣는다. 조회 때마다 변환하면 지도를
-- 움직일 때마다 매장 수만큼 외부 API 를 부르게 되고, 그 API 가 죽으면 지도가 통째로 빈다.
ALTER TABLE "tenants" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "tenants" ADD COLUMN "longitude" DOUBLE PRECISION;

-- 주소를 넣으면 기본 노출. 끄는 스위치를 두는 이유는 가정집에서 운영하는 소규모
-- 유치원이 있기 때문이다 — 그 경우 주소 공개가 곧 자택 공개다.
-- 기존 행은 주소가 없어 어차피 지도에 뜨지 않으므로 DEFAULT true 로 채워도 안전하다.
ALTER TABLE "tenants" ADD COLUMN "is_listed" BOOLEAN NOT NULL DEFAULT true;

-- 지도 뷰포트 안의 매장을 찾는 유일한 조회 패턴(bounding box).
CREATE INDEX "tenants_latitude_longitude_idx" ON "tenants"("latitude", "longitude");
