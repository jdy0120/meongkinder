"use client";

import { ImageOff } from "lucide-react";
import { Skeleton } from "@pawlog/ui";

import { useFileUrl } from "../model/useFileUrl";

interface PhotoImageProps {
  fileId: string;
  /**
   * 대체 텍스트. **사진이 내용인 자리에서는 반드시 넘긴다** — 이 앱의 사진은 장식이
   * 아니라 그날의 기록이라, 비어 있으면 보조기술 사용자에게 알림장이 통째로 사라진다.
   *
   * 기본값이 `""`(장식)인 이유: 바로 옆에 같은 정보를 글로 쓴 자리(아바타 + 이름)가
   * 있어서, 거기서 이름을 다시 읽으면 같은 말이 두 번 나온다.
   */
  alt?: string;
  className?: string;
  /**
   * 즉시 로드할지. 기본은 지연 로드다.
   *
   * 피드·알림장은 한 화면에 사진이 수십 장 쌓이는데 전부 즉시 받으면 현장의 LTE 에서
   * 첫 화면이 늦어진다. **화면 최상단에 처음부터 보이는 사진**(상세 화면의 대표 사진)만
   * `priority` 로 올린다 — 지연 로드된 첫 화면 이미지는 오히려 늦게 나타난다.
   */
  priority?: boolean;
}

/** fileId 로 v1/file/:fileId 를 조회해 실제 이미지를 렌더링 (entity ui) */
export const PhotoImage = ({
  fileId,
  alt = "",
  className,
  priority = false,
}: PhotoImageProps) => {
  const { data: file, isLoading, isError } = useFileUrl(fileId);

  if (isLoading) {
    return <Skeleton className={className} />;
  }

  if (isError || !file) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
        // 아이콘만으로는 "무슨 일이 일어났는지"가 전달되지 않는다. 색·모양이 아니라
        // 글로도 남긴다(색만으로 의미를 전하지 않는다 — WCAG 1.4.1).
        role='img'
        aria-label={alt ? `${alt} — 사진을 불러오지 못했습니다` : "사진을 불러오지 못했습니다"}
      >
        <ImageOff className='size-6' aria-hidden='true' />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file.url}
      alt={alt}
      className={className}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding='async'
    />
  );
};
