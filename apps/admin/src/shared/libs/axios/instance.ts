import axios from "axios";
import { insertAccessToken, refreshAccessToken } from "./interceptors";

const axiosInstance = axios.create({
  baseURL:
    typeof window === "undefined"
      ? `${process.env.API_BASE_URL}/api/${process.env.PROJECT_NAME}`
      : `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/${process.env.PROJECT_NAME}` ||
        "http://localhost:5175",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// insert access token to request header
axiosInstance.interceptors.request.use(insertAccessToken, (error) => {
  return Promise.reject(error);
});

axiosInstance.interceptors.response.use(
  (response) => response,
  refreshAccessToken,
);

export { axiosInstance };
