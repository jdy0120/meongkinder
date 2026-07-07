"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";

export interface CreateTermsInput {
  title: string;
  type: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  file: File;
}

/**
 * 신규 약관 버전 등록 뮤테이션 (feature model).
 * 파일 업로드 후 반환된 fileId 로 약관을 생성한다.
 */
export const useCreateTerms = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTermsInput) => {
      const formData = new FormData();
      formData.append("files", input.file);

      // Content-Type 을 수동 지정하면 multipart boundary 가 누락되어 서버(multer)가
      // 파일을 파싱하지 못한다. undefined 로 두어 브라우저가 boundary 를 자동 생성하게 한다.
      const uploadRes = await Post<{ id: string }[], FormData>(
        "/v1/file/upload",
        formData,
        { headers: { "Content-Type": undefined } },
      );

      const fileId = uploadRes.data.data?.[0]?.id;
      if (!fileId) {
        throw new Error("파일 업로드 응답에서 ID를 찾을 수 없습니다.");
      }

      await Post("/v1/admin/terms", {
        title: input.title,
        type: input.type,
        version: input.version,
        isRequired: input.isRequired,
        isActive: input.isActive,
        fileId,
      });
    },
    onSuccess: () => {
      toast.success("신규 약관 버전이 성공적으로 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      onSuccess?.();
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "약관 등록에 실패했습니다.";
      toast.error(msg);
    },
  });
};
