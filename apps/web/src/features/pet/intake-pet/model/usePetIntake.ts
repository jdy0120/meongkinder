"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PetIntakeLookupResponse,
  PetIntakeRequest,
  PetIntakeResponse,
} from "@pawlog/shared";
import { PET_INTAKE_MODE } from "@pawlog/shared";

import { Get, Post } from "@/shared/libs/axios/request";

/**
 * 전화번호로 보호자와 등록 후보 아이를 조회한다 (feature model).
 *
 * `enabled` 를 붙여 **원장이 조회 버튼을 누른 뒤에만** 돈다. 타이핑하는 대로 조회하면
 * 번호를 한 자씩 바꿔가며 회원 존재 여부를 훑는 것과 같아진다.
 */
export const usePetIntakeLookup = (phone: string, enabled: boolean) =>
  useQuery({
    queryKey: ["pet-intake-lookup", phone],
    queryFn: async () => {
      const res = await Get<PetIntakeLookupResponse, { phone: string }>(
        "/v1/admin/pets/intake/lookup",
        { phone },
      );
      return res.data.data ?? null;
    },
    enabled: enabled && phone.replace(/[^0-9]/g, "").length >= 10,
    // 등록 직후 다시 열었을 때 옛 결과가 뜨면 안 된다(방금 등록한 아이가 안 보인다).
    staleTime: 0,
  });

const SUCCESS_MESSAGE: Record<string, string> = {
  [PET_INTAKE_MODE.ENROLLED_EXISTING]: "아이가 원생으로 등록되었습니다.",
  [PET_INTAKE_MODE.CREATED_FOR_MEMBER]: "원생이 등록되었습니다.",
  [PET_INTAKE_MODE.CREATED_FOR_UNREGISTERED]:
    "원생이 등록되었습니다. 보호자가 아직 가입 전이라 알림은 입력한 번호로 발송됩니다.",
};

/**
 * 원생 등록 (feature model).
 *
 * 회원/미가입 분기는 **서버가 판단한다** — 원장은 전화번호만 알고 시작하므로, 어느 쪽인지
 * 프런트가 먼저 정해서 다른 엔드포인트를 부르는 구조면 그 판단이 두 군데로 갈린다.
 * 여기서는 결과(`mode`)를 받아 안내 문구만 다르게 보여준다.
 */
export const useIntakePet = (onSuccess?: (result: PetIntakeResponse) => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PetIntakeRequest) => {
      const res = await Post<PetIntakeResponse, PetIntakeRequest>(
        "/v1/admin/pets/intake",
        data,
      );
      return res.data.data as PetIntakeResponse;
    },
    onSuccess: (result) => {
      toast.success(SUCCESS_MESSAGE[result.mode] ?? "원생이 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["pet-intake-lookup"] });
      onSuccess?.(result);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "등록에 실패했습니다.");
    },
  });
};
