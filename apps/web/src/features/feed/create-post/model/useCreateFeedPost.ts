"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateFeedPostRequest, FeedPostResponse } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 게시물 작성 (feature model).
 * 발행하면 서버가 태그된 아이의 보호자에게 팬아웃하고 알림톡을 보낸다.
 */
export const useCreateFeedPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateFeedPostRequest) => {
      const res = await Post<FeedPostResponse, CreateFeedPostRequest>(
        "/v1/feed/posts",
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      // 사진이 올라가면 커버리지("오늘 0장")와 출석부가 함께 바뀐다.
      queryClient.invalidateQueries({ queryKey: ["feed-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success("게시물이 올라갔습니다.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "게시에 실패했습니다.");
    },
  });
};
