"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RunFeedDigestRequest, RunFeedDigestResponse } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 하루 마감 (feature model).
 * 오늘 올린 사진들을 아이별로 묶어 알림장을 만든다 — 선생님은 알림장을 직접 쓰지 않는다.
 */
export const useRunFeedDigest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RunFeedDigestRequest = {}) => {
      const res = await Post<RunFeedDigestResponse, RunFeedDigestRequest>(
        "/v1/feed/digest",
        payload,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daily-reports"] });

      const results = data?.results ?? [];
      if (results.length === 0) {
        // 사진이 한 장도 없으면 만들 알림장도 없다. 성공 토스트만 띄우면
        // 선생님은 다 됐다고 믿고 화면을 닫는다.
        toast.warning(
          "오늘 발행된 사진이 없어 만들 알림장이 없어요. 사진을 먼저 올려주세요.",
        );
        return;
      }

      const created = results.filter((r) => r.action === "CREATED").length;
      const updated = results.length - created;
      toast.success(
        [
          created > 0 && `알림장 ${created}건을 만들었어요`,
          updated > 0 && `${updated}건은 새 사진으로 갱신했어요`,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "하루 마감에 실패했습니다.");
    },
  });
};
