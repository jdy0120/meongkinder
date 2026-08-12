import { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { apiUrl, getProjectName } from "./base-url";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Concurrent 401s (e.g. parallel widget requests) must share a single
// refresh call — the backend rotates the refresh token on each call, so
// firing one refresh per request invalidates the others mid-flight.
let refreshPromise: Promise<boolean> | null = null;

const requestRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      // Using standard axios to avoid recursion loop in interceptor
      // withCredentials: true sends the HttpOnly refresh_token cookie automatically
      //
      // ⚠️ 주소는 반드시 apiUrl() 로 만든다 — 프리픽스를 손으로 붙이면
      // `/api/<p>/api/<p>/…` 가 되어 404 이고, 그 404 는 아래 catch 에서
      // "재발급 실패" 로 삼켜져 곧장 로그아웃으로 이어진다 (base-url.ts 주석 참고).
      .post(apiUrl("/v1/auth/refresh"), {}, { withCredentials: true })
      .then((res) => {
        const data = res.data?.data || res.data;
        return res.status === 200 || Boolean(data?.accessToken);
      })
      .catch((err) => {
        console.error("Token refresh failed:", err);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Response interceptor for handling token expiration
const refreshAccessToken = async (error: ApiError) => {
  const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

  const isAuthRequest =
    originalRequest?.url?.includes("/v1/auth/login") ||
    originalRequest?.url?.includes("/v1/auth/signup") ||
    originalRequest?.url?.includes("/v1/auth/refresh");

  if (
    error.response?.status === 401 &&
    originalRequest &&
    !originalRequest._retry &&
    !isAuthRequest
  ) {
    originalRequest._retry = true;

    const refreshSuccess = await requestRefresh();

    if (refreshSuccess) {
      // Re-create the request using the main axiosInstance
      const { axiosInstance } = await import("./instance");
      return axiosInstance(originalRequest);
    }

    // If refresh failed or was not possible, logout and redirect
    // HttpOnly 쿠키는 JS로 삭제 불가 — 서버 로그아웃 API를 호출해 쿠키를 서버에서 제거
    if (typeof window !== "undefined") {
      const proj = getProjectName();
      document.cookie = `${proj}_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
      document.cookie = `${proj}_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
      try {
        await axios.post(apiUrl("/v1/auth/logout"), {}, { withCredentials: true });
      } catch {
        // 로그아웃 API 실패해도 클라이언트 정리 후 리다이렉트
      }
      sessionStorage.clear();
      window.location.href = "/auth/login";
    }
  }

  return Promise.reject(error);
};

export { refreshAccessToken };
