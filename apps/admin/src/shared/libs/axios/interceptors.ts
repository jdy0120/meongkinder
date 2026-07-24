import { InternalAxiosRequestConfig } from "axios";
import axios from "axios";

// Request interceptor
const insertAccessToken = (config: InternalAxiosRequestConfig) => {
  const loginSession =
    typeof window !== "undefined" ? sessionStorage.getItem("login") : null;
  let accessToken = null;

  if (loginSession) {
    try {
      const parsed = JSON.parse(loginSession);
      accessToken = parsed?.state?.accessToken;
    } catch (error) {
      console.error("Failed to parse token:", error);
    }
  }

  if (config.headers && accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
};

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

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

    const proj = process.env.NEXT_PUBLIC_PROJECT_NAME || "monorepo-template";
    let refreshSuccess = false;

    try {
      // Using standard axios to avoid recursion loop in interceptor
      // withCredentials: true sends the HttpOnly refresh_token cookie automatically
      const res = await axios.post(
        `${originalRequest.baseURL || ""}/api/${proj}/v1/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      );

      const data = res.data?.data || res.data;
      if (res.status === 200 || data?.accessToken) {
        refreshSuccess = true;
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }

    if (refreshSuccess) {
      // Re-create the request using the main axiosInstance
      const { axiosInstance } = await import("./instance");
      return axiosInstance(originalRequest);
    }

    // If refresh failed or was not possible, logout and redirect
    // HttpOnly 쿠키는 JS로 삭제 불가 — 서버 로그아웃 API를 호출해 쿠키를 서버에서 제거
    if (typeof window !== "undefined") {
      document.cookie = `${proj}_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
      document.cookie = `${proj}_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
      try {
        await axios.post(
          `${originalRequest?.baseURL || ""}/api/${proj}/v1/auth/logout`,
          {},
          { withCredentials: true },
        );
      } catch {
        // 로그아웃 API 실패해도 클라이언트 정리 후 리다이렉트
      }
      sessionStorage.clear();
      window.location.href = "/auth/login";
    }
  }

  return Promise.reject(error);
};

export { insertAccessToken, refreshAccessToken };
