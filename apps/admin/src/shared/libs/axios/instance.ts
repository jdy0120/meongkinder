import axios from "axios";
import { refreshAccessToken } from "./interceptors";
import { getBaseUrl } from "./base-url";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// 매 요청 시점에 런타임 baseURL 적용 (인증은 httpOnly 쿠키로 처리되어 별도 헤더 주입 불필요)
// tenantId는 TenantSync가 로그인 사용자의 SSR mypage 조회 결과로 채워둔 store에서 읽는다.
// (SUPER_ADMIN 등 미소속 사용자는 tenantId가 없어 헤더를 생략 — 서버는 JWT 클레임으로 폴백한다)
axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const tenantId = useTenantStore.getState().tenantId;
  if (tenantId) {
    config.headers.set("X-Tenant-Id", tenantId);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

axiosInstance.interceptors.response.use(
  (response) => response,
  refreshAccessToken,
);

export { axiosInstance, getBaseUrl };
