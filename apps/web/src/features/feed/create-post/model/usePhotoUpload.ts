"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { uploadPhotos } from "@/shared/libs/file/uploadPhotos";
import type { ComposerPhoto } from "@/entities/feed";

/**
 * 사진 선택 → 리사이징 → 청크 업로드 (feature model).
 *
 * 미리보기는 브라우저에서 즉시 만들어 붙이고 업로드는 뒤에서 돈다. 사진을 고른 뒤 화면이
 * 멈춰 있으면 선생님은 그 자리에서 기다리게 되는데, 이 제품이 파는 건 "노는 중에 5초"라
 * 기다림이 생기는 순간 명분이 사라진다.
 */
export const usePhotoUpload = () => {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress({ done: 0, total: files.length });
      try {
        const uploaded = await uploadPhotos(files, (done, total) =>
          setProgress({ done, total }),
        );
        return uploaded.map<ComposerPhoto>((file, index) => ({
          key: file.id,
          fileId: file.id,
          previewUrl: URL.createObjectURL(files[index] ?? files[0]),
          name: file.originalName,
          petIds: [],
        }));
      } finally {
        setProgress(null);
      }
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          "사진 업로드에 실패했습니다. 신호가 약하면 잠시 뒤 다시 시도해주세요.",
      );
    },
  });

  return { ...mutation, progress };
};
