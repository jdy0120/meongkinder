"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";

interface UpdateProfilePayload {
  nickname?: string;
  phone?: string;
  /** 알림 수신 번호를 새 번호로 함께 바꿀 아이들 (job-060). */
  syncPetIds?: string[];
}

interface UpdateProfileResult {
  claimedInvitations: number;
  /** 실제로 알림 번호가 옮겨진 아이 수. 요청보다 적을 수 있다(서버가 조건을 다시 본다). */
  syncedPets?: number;
}

/**
 * 내 정보 수정 (feature model).
 *
 * 전화번호를 등록하면 서버가 그 번호로 와 있던 매장 초대를 자동으로 소속 처리한다
 * (카카오 로그인은 전화번호를 주지 않아 가입 시점에는 매칭할 수 없다).
 * 몇 건이 연결됐는지 응답으로 오므로 사용자에게 알려준다.
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfilePayload) => {
      const res = await Patch<UpdateProfileResult, UpdateProfilePayload>(
        "/v1/auth/me",
        data,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const claimed = data?.claimedInvitations ?? 0;
      const synced = data?.syncedPets ?? 0;

      const notes = [
        claimed > 0 ? `매장 초대 ${claimed}건 연결` : null,
        synced > 0 ? `아이 ${synced}마리의 알림 번호 변경` : null,
      ].filter(Boolean);

      toast.success(
        notes.length
          ? `정보를 저장했습니다. (${notes.join(" · ")})`
          : "정보를 저장했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      // 알림 번호가 바뀌었으면 아이 목록의 연락처도 예전 값이다.
      queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "저장에 실패했습니다.";
      toast.error(msg);
    },
  });
};
