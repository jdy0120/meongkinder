"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RunFeedDigestRequest, RunFeedDigestResponse } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 마감했는데 만들어진 알림장이 0건일 때의 안내.
 *
 * ⚠️ **사유를 한 문구로 뭉치지 않는다.** 예전에는 이유와 무관하게
 * "오늘 발행된 사진이 없어 만들 알림장이 없어요. 사진을 먼저 올려주세요" 하나만 띄웠다.
 * 그런데 사진 4장을 이미 올리고 발행까지 마친 매장에서도 같은 말이 나오기 때문에,
 * 선생님은 진짜 원인(사진에 아이 태그가 0개)을 못 찾고 업로드 화면만 다시 확인하게 된다.
 * 실제로 그렇게 막힌 사례가 있었고, 이 함수가 그 사례를 고치는 지점이다.
 *
 * 세 경우는 **다음에 눌러야 할 버튼이 서로 다르다** — 그래서 문구도 끝까지 갈라야 한다.
 */
const emptyMessage = (data?: RunFeedDigestResponse): string => {
  const published = data?.publishedPostCount ?? 0;
  const drafts = data?.draftPostCount ?? 0;

  switch (data?.emptyReason) {
    case "NO_TAGS":
      // 가장 헷갈리는 경우 — 사진도 있고 발행도 했는데 아무 일도 안 일어난다.
      // 화면상 "성공"과 구분이 안 되므로 무엇이 빠졌는지 정확히 말한다.
      return `발행한 사진 ${published}건에 태그된 아이가 없어요. 사진마다 아이를 태그해야 그 아이의 알림장이 만들어집니다.`;
    case "ALL_DRAFT":
      return `사진 ${drafts}건이 아직 초안이에요. 발행해야 마감 대상이 됩니다.`;
    case "NO_POSTS":
      return "오늘 올린 사진이 없어 만들 알림장이 없어요. 사진을 먼저 올려주세요.";
    default:
      // 구버전 서버(사유를 안 내려주는)와 붙어도 최소한 거짓말은 하지 않는다.
      return "만들어진 알림장이 없어요. 사진이 발행됐는지, 사진에 아이가 태그됐는지 확인해주세요.";
  }
};

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
        // 성공 토스트만 띄우면 선생님은 다 됐다고 믿고 화면을 닫는다.
        // 기본 표시 시간으로는 두 줄짜리 안내를 다 읽기 전에 사라져서 길게 잡는다.
        toast.warning(emptyMessage(data), { duration: 8000 });
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
