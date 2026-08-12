"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SuggestFeedTagsResponse } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 방금 올린 사진에 대한 아이 태그 제안 (feature model).
 *
 * 서버가 후보를 **오늘 등원한 아이**로 좁혀 돌려준다. 전체 원생 명단이 아니라 20지선다가
 * 되는 것이 이 화면이 빠른 이유다.
 */
export const useSuggestFeedTags = () =>
  useMutation({
    mutationFn: async (fileIds: string[]) => {
      const res = await Post<SuggestFeedTagsResponse, { fileIds: string[] }>(
        "/v1/feed/suggest-tags",
        { fileIds },
      );
      return res.data.data;
    },
    onError: (error) => {
      // 제안 실패는 치명적이지 않다 — 후보 목록 없이 직접 고르면 되므로 조용히 알리기만 한다.
      toast.error(
        error.response?.data?.message || "아이 추천을 불러오지 못했습니다.",
      );
    },
  });
