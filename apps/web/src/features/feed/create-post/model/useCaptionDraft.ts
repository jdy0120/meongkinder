"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";

/**
 * 캡션 초안 요청 (feature model).
 * 태그된 아이 이름과 시간대를 근거로 서버가 한 줄을 제안한다. 선생님은 그대로 쓰거나 고친다.
 */
export const useCaptionDraft = () =>
  useMutation({
    mutationFn: async (petIds: string[]) => {
      const res = await Post<{ caption: string }, { petIds: string[] }>(
        "/v1/feed/caption-draft",
        { petIds },
      );
      return res.data.data?.caption ?? null;
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "문구 추천을 받지 못했습니다.",
      );
    },
  });
