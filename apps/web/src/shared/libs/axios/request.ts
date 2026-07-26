import { AxiosRequestConfig, AxiosResponse } from "axios";

import { axiosInstance } from "./instance";

import {
  toQueryParams,
  type BaseResponse,
  type PaginatedData,
  type PaginationQuery,
} from "@pawlog/shared";

const Get = async <T, D>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<T>>> => {
  const response = await axiosInstance.get(url, {
    params: data,
    ...config,
  });
  return response;
};

// 공통 목록 조회 — @pawlog/shared 유틸로 쿼리 생성 + 응답 타이핑
const GetList = async <T>(
  url: string,
  query: PaginationQuery = {},
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<PaginatedData<T>>>> => {
  const response = await axiosInstance.get(url, {
    params: toQueryParams(query),
    ...config,
  });
  return response;
};

const Post = async <T, D>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<T>>> => {
  const response = await axiosInstance.post(url, data, config);
  return response;
};

const Put = async <T, D>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<T>>> => {
  const response = await axiosInstance.put(url, data, config);
  return response;
};

const Patch = async <T, D>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<T>>> => {
  const response = await axiosInstance.patch(url, data, config);
  return response;
};

const Delete = async <T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<BaseResponse<T>>> => {
  const response = await axiosInstance.delete(url, config);
  return response;
};

export { Delete, Get, GetList, Patch, Post, Put };
