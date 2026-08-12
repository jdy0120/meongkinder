"use client";

import { ImageOff } from "lucide-react";
import { Skeleton } from "@pawlog/ui";

import { useFileUrl } from "../model/useFileUrl";

interface PhotoImageProps {
  fileId: string;
  alt?: string;
  className?: string;
}

/** fileId 로 v1/file/:fileId 를 조회해 실제 이미지를 렌더링 (entity ui) */
export const PhotoImage = ({ fileId, alt = "", className }: PhotoImageProps) => {
  const { data: file, isLoading, isError } = useFileUrl(fileId);

  if (isLoading) {
    return <Skeleton className={className} />;
  }

  if (isError || !file) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
      >
        <ImageOff className='size-6' />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={file.url} alt={alt} className={className} draggable={false} />;
};
