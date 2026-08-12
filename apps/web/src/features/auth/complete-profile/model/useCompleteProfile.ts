"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CompleteProfileRequest } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 공개 알림장 링크에서 들고 온 초대 토큰 (job-047).
 * 이게 있으면 전화번호를 묻지 않고도 그 아이를 계정에 연결할 수 있다.
 */
const INVITE_KEY = "pawlog:invite";

interface CompleteProfileResult {
  claimedInvitations: number;
}

/**
 * 최초 진입 완료 뮤테이션 (feature model) — 필수 약관 동의 + (선택) 전화번호.
 *
 * 성공하면 **하드 내비게이션**(`router.refresh()` 후 push)이 필요하다. 게이트 판단이
 * `(checkauth)` 레이아웃의 SSR `mypage` 응답에 달려 있어서, 클라이언트 캐시만 갈아치우면
 * 레이아웃이 예전 응답 그대로 다시 /welcome 으로 돌려보낸다.
 */
export const useCompleteProfile = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CompleteProfileRequest) => {
      const res = await Post<CompleteProfileResult, CompleteProfileRequest>(
        "/v1/auth/complete-profile",
        data,
      );
      return res.data.data;
    },
    onSuccess: async (result) => {
      // 링크로 들어온 사람은 번호 없이도 연결된다 — 토큰 자체가 "이 아이의 보호자"라는 증거다.
      const invite =
        typeof window !== "undefined" ? sessionStorage.getItem(INVITE_KEY) : null;
      if (invite) {
        try {
          await Post("/v1/invitations/accept", { token: invite });
        } catch {
          // 이미 수락됐거나 만료된 초대 — 진행을 막을 이유가 없다.
        }
        sessionStorage.removeItem(INVITE_KEY);
      }

      const claimed = result?.claimedInvitations ?? 0;
      toast.success(
        claimed > 0
          ? `설정이 완료되었어요. 등록돼 있던 아이 정보 ${claimed}건을 연결했습니다.`
          : "설정이 완료되었어요.",
      );
      router.refresh();
      // job-042: `/app` 이 아니라 `/launch` 로 넘긴다 — 여기서 방금 연결된 소속에 따라
      // 갈 곳이 갈리기 때문이다(매장 하나면 그 매장으로 직행). `/app` 으로 보내면
      // 최초 로그인 사용자만 그 라우팅을 못 받는다.
      router.push("/launch");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "저장에 실패했습니다.");
    },
  });
};
