"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, PawPrint, X } from "lucide-react";
import { Button, Spinner } from "@pawlog/ui";

import { PhotoImage } from "./PhotoImage";
import { useUploadFile } from "../model/useUploadFile";

interface AvatarUploadProps {
  /** 현재 값. 업로드 전에는 `undefined`. */
  value?: string;
  onChange: (fileId: string | undefined) => void;
  /** 폴백에 쓸 이름 (첫 글자). 비어 있으면 발바닥 아이콘. */
  name?: string;
}

/**
 * 프로필 사진 한 장 업로드 (job-053).
 *
 * ## 왜 미리보기를 로컬 URL 로 먼저 그리는가
 *
 * 업로드가 끝나야 `fileId` 가 생기고 그때부터 서버 이미지를 조회할 수 있는데, 등하원 현장의
 * 회선에서 그 왕복은 체감이 크다. 고른 즉시 `createObjectURL` 로 보여주면 "눌렀는데 아무
 * 반응이 없다"가 사라진다 — 실제로 올라가는 중인지는 스피너가 말한다.
 *
 * ## 삭제 버튼이 필요한 이유
 *
 * 잘못 고른 사진을 되돌릴 방법이 없으면 원장은 폼을 닫고 처음부터 다시 연다. 그러면 이미
 * 입력한 다른 칸도 함께 날아간다.
 */
export const AvatarUpload = ({ value, onChange, name }: AvatarUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const upload = useUploadFile();

  // objectURL 은 명시적으로 해제하지 않으면 페이지를 떠날 때까지 메모리에 남는다.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;

    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    const uploaded = await upload.mutateAsync(file);
    // 실패하면 `onError` 토스트가 이미 떴다. 미리보기를 걷어내 "올라간 것처럼 보이는"
    // 상태를 남기지 않는다 — 저장해 보고 나서야 사진이 없다는 걸 알게 되면 안 된다.
    if (!uploaded) {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    onChange(uploaded.id);
  };

  const clear = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onChange(undefined);
    // 같은 파일을 다시 고를 수 있게 비운다 — 안 비우면 change 이벤트가 안 뜬다.
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasPhoto = Boolean(preview || value);

  return (
    <div className='flex items-center gap-4'>
      <div className='relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-primary-tint'>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            // 방금 고른 사진의 미리보기다. 바로 옆에 '사진 바꾸기' 버튼이 있어
            // 같은 말을 두 번 읽게 되므로 장식으로 둔다.
            alt=''
            className='size-full object-cover'
            draggable={false}
            decoding='async'
          />
        ) : value ? (
          <PhotoImage fileId={value} className='size-full object-cover' />
        ) : (
          <div className='flex size-full items-center justify-center text-primary-on-tint'>
            {name ? (
              <span className='text-name'>{name.charAt(0)}</span>
            ) : (
              <PawPrint className='size-7' />
            )}
          </div>
        )}

        {upload.isPending && (
          <div className='absolute inset-0 flex items-center justify-center bg-surface/70'>
            <Spinner className='size-6 text-primary' />
          </div>
        )}
      </div>

      <div className='flex min-w-0 flex-col gap-2'>
        <input
          ref={inputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={(event) => pick(event.target.files?.[0])}
        />

        <div className='flex gap-2'>
          {/* ⚠️ `size='sm'` 을 쓰지 않는다 — apps/web 의 터치 타겟은 64px 이 하한이다
              (design-system.md §2.3). 젖은 손에서 작은 버튼은 그냥 안 눌린다. */}
          <Button
            type='button'
            variant='outline'
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            <Camera />
            {hasPhoto ? "사진 변경" : "사진 추가"}
          </Button>

          {hasPhoto && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={clear}
              disabled={upload.isPending}
              aria-label='사진 삭제'
            >
              <X />
            </Button>
          )}
        </div>

        <p className='break-keep text-label text-muted-foreground'>
          정면 얼굴이 잘 보이는 사진이 좋아요.
        </p>
      </div>
    </div>
  );
};
