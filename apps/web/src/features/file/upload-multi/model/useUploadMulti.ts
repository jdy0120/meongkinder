"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";
import { resizeImage } from "@/shared/libs/file/resizeImage";

export interface UploadedFile {
  id: string;
  originalName: string;
}

/**
 * 다중 파일 업로드 뮤테이션 (feature model).
 * v1/file/upload 는 "files" 필드 여러 개를 한 요청으로 받아 배열로 응답한다.
 *
 * job-053: **업로드 전 리사이징이 빠져 있었다.** 피드 경로(`uploadPhotos`)에는 있는데
 * 이쪽(알림장 사진)에는 없어서 12MP 원본이 그대로 올라갔다 — 저장 크기가 6배였다
 * (실측: 1600px WebP 123KB vs 원본 해상도 WebP 722KB). 리사이징을 공용 라이브러리에 두고도
 * 새 업로드 화면에서 빠뜨린 사례라, 화면이 늘 때마다 반복될 수 있는 종류의 누락이다.
 * 서버에도 WebP 변환이 있지만 **서버는 포맷만 바꾸고 크기는 줄이지 않는다.**
 */
export const useUploadMulti = () =>
  useMutation({
    mutationFn: async (input: File[]) => {
      // 이미지가 아니거나 이미 작으면 원본이 그대로 돌아온다.
      const files = await Promise.all(input.map(resizeImage));

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      // Content-Type 을 수동 지정하면 multipart boundary 가 누락되어 서버(multer)가
      // 파일을 파싱하지 못한다. undefined 로 두어 브라우저가 boundary 를 자동 생성하게 한다.
      const res = await Post<UploadedFile[], FormData>(
        "/v1/file/upload",
        formData,
        { headers: { "Content-Type": undefined } },
      );
      return res.data.data ?? [];
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message || "사진 업로드에 실패했습니다.";
      toast.error(msg);
    },
  });
