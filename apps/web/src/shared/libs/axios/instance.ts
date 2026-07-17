import axios from "axios";
import { insertAccessToken, refreshAccessToken } from "./interceptors";

const getBaseUrl = () => {
  if (typeof window === "undefined") {
    const apiUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3000";
    const proj =
      process.env.PROJECT_NAME ||
      process.env.NEXT_PUBLIC_PROJECT_NAME ||
      "myapp";
    return `${apiUrl}/api/${proj}`;
  }
  const publicApiUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
  const publicProj = process.env.NEXT_PUBLIC_PROJECT_NAME || "myapp";
  return `${publicApiUrl}/api/${publicProj}`;
};

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// insert access token to request header & 매 요청 시점에 런타임 baseURL 적용
axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseUrl();
    return insertAccessToken(config);
  },
  (error) => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => response,
  refreshAccessToken,
);

export { axiosInstance, getBaseUrl };
