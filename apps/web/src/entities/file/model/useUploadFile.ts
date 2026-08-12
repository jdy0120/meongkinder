"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";
import { resizeImage } from "@/shared/libs/file/resizeImage";

export interface UploadedFileMeta {
  id: string;
  originalName: string;
}

/**
 * 단일 파일 임시 업로드 (job-053).
 *
 * `features/file/upload-multi` 의 `useUploadMulti` 와 같은 엔드포인트를 쓰지만 여기(entity)에
 * 둔다 — 프로필 사진 입력이 필요한 곳이 전부 **feature**(원생 등록·원생 수정·내 아이 등록)라
 * feature → feature import 가 금지되기 때문이다(FSD §7). 공유는 entities 를 거친다.
 *
 * 업로드 전 리사이징을 반드시 통과시킨다. 서버에도 WebP 변환이 있지만 **서버는 포맷만 바꾸고
 * 크기는 줄이지 않아서**, 빠뜨리면 12MP 원본이 그대로 저장된다(job-053 에서 알림장 경로가
 * 실제로 그랬다).
 */
export const useUploadFile = () =>
  useMutation({
    mutationFn: async (input: File) => {
      // 이미지가 아니거나 이미 작으면 원본이 그대로 돌아온다.
      const file = await resizeImage(input);

      const formData = new FormData();
      formData.append("files", file);

      // Content-Type 을 수동 지정하면 multipart boundary 가 누락되어 서버(multer)가
      // 파일을 파싱하지 못한다. undefined 로 두어 브라우저가 boundary 를 만들게 한다.
      const res = await Post<UploadedFileMeta[], FormData>(
        "/v1/file/upload",
        formData,
        { headers: { "Content-Type": undefined } },
      );
      return res.data.data?.[0] ?? null;
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "사진 업로드에 실패했습니다.";
      toast.error(msg);
    },
  });
