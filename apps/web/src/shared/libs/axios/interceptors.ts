import { InternalAxiosRequestConfig, AxiosError } from "axios";
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
const refreshAccessToken = async (error: AxiosError) => {
  const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

  const isAuthRequest =
    originalRequest?.url?.includes("/auth/login") ||
    originalRequest?.url?.includes("/auth/submit-otp") ||
    originalRequest?.url?.includes("/auth/refresh");

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
        `${originalRequest.baseURL || ""}/api/${proj}/auth/refresh`,
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
    if (typeof window !== "undefined") {
      document.cookie =
        "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      document.cookie =
        "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      sessionStorage.clear();
      window.location.href = "/auth/login";
    }
  }

  return Promise.reject(error);
};

export { insertAccessToken, refreshAccessToken };
