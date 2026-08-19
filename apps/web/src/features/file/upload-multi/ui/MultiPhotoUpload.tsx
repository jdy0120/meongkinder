"use client";

import { useRef, useState, type DragEvent, type PointerEvent, useEffect } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card } from "@pawlog/ui";

import { PhotoImage } from "@/entities/file";

import { useUploadMulti } from "../model/useUploadMulti";

export interface PetOption {
  id: string;
  name: string;
}

export interface PhotoTagItem {
  fileId: string;
  /** 이번 세션에 새로 업로드한 사진은 브라우저 로컬 미리보기(blob URL)를 가진다.
   *  기존에 저장된 사진은 previewUrl 없이 fileId 로 v1/file/:fileId 를 조회해 표시한다. */
  previewUrl: string | null;
  label: string;
  /** 이 사진에 태그된 아이(펫) id 목록 (드래그 일괄 태깅으로 채워짐) */
  petIds: string[];
}

interface MultiPhotoUploadProps {
  pets: PetOption[];
  value: PhotoTagItem[];
  onChange: (next: PhotoTagItem[]) => void;
}

/**
 * 여러 장 사진 업로드 + 미리보기 + 아이 태그 (feature ui).
 * 사진 카드를 포인터로 눌러 드래그하면 여러 장이 한 번에 선택되고,
 * 선택된 상태에서 아이 칩을 클릭하면 선택된 사진 전체에 그 아이가 일괄 태깅된다.
 * (모바일웹/태블릿 터치 드래그도 Pointer Events 로 동일하게 동작)
 */
export const MultiPhotoUpload = ({
  pets,
  value,
  onChange,
}: MultiPhotoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);
  const dragModeRef = useRef<"add" | "remove">("add");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDropping, setIsDropping] = useState(false);
  const uploadMulti = useUploadMulti();

  /**
   * 언마운트 시 남은 preview URL 회수 (job-051).
   * FeedComposer 와 같은 이유 — 지우거나 제출했을 때만 회수하면, 뒤로가기·이탈 경로에서
   * 사진 blob 이 페이지 수명 내내 메모리에 남는다. ref 로 최신 목록을 본다.
   */
  const valueRef = useRef(value);
  // 렌더 중 ref 대입은 React Compiler 규칙 위반 — effect 에서 동기화한다.
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(
    () => () => {
      valueRef.current.forEach((photo) => {
        if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      });
    },
    [],
  );

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (list.length === 0) return;

    const uploaded = await uploadMulti.mutateAsync(list);
    const next: PhotoTagItem[] = uploaded.map((file, index) => ({
      fileId: file.id,
      previewUrl: URL.createObjectURL(list[index]),
      label: file.originalName,
      petIds: [],
    }));
    onChange([...value, ...next]);
  };

  const removePhoto = (fileId: string) => {
    const target = value.find((photo) => photo.fileId === fileId);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((photo) => photo.fileId !== fileId));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const untagPet = (fileId: string, petId: string) => {
    onChange(
      value.map((photo) =>
        photo.fileId === fileId
          ? { ...photo, petIds: photo.petIds.filter((id) => id !== petId) }
          : photo,
      ),
    );
  };

  const toggleSelect = (fileId: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(fileId);
      else next.delete(fileId);
      return next;
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>, fileId: string) => {
    // 터치 환경에서 브라우저가 암묵적으로 포인터를 캡처하면 다른 카드의 pointerenter 가
    // 발생하지 않아 드래그 다중 선택이 동작하지 않는다. 캡처를 해제해 드래그를 전 카드에서 감지한다.
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    draggingRef.current = true;
    dragModeRef.current = selected.has(fileId) ? "remove" : "add";
    toggleSelect(fileId, dragModeRef.current);
  };

  const handlePointerEnter = (fileId: string) => {
    if (!draggingRef.current) return;
    toggleSelect(fileId, dragModeRef.current);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDropping(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const applyTagToSelected = (pet: PetOption) => {
    if (selected.size === 0) return;
    onChange(
      value.map((photo) =>
        selected.has(photo.fileId) && !photo.petIds.includes(pet.id)
          ? { ...photo, petIds: [...photo.petIds, pet.id] }
          : photo,
      ),
    );
    toast.success(`사진 ${selected.size}장에 '${pet.name}' 태그를 추가했습니다.`);
    setSelected(new Set());
  };

  return (
    <div className='space-y-3' onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropping(true);
        }}
        onDragLeave={() => setIsDropping(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDropping ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <ImagePlus className='w-6 h-6 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>
          사진을 끌어다 놓거나 아래 버튼으로 여러 장을 한 번에 업로드하세요.
        </p>
        <Button
          type='button'
          variant='outline'
         
          disabled={uploadMulti.isPending}
          onClick={() => inputRef.current?.click()}
          className='rounded-xl gap-1.5'
        >
          {uploadMulti.isPending && <Loader2 className='w-4 h-4 animate-spin' />}
          사진 추가
        </Button>
        <input
          ref={inputRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {selected.size > 0 && (
        <div className='flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3'>
          <span className='text-xs font-semibold text-primary'>
            {selected.size}장 선택됨 — 태그할 아이 선택
          </span>
          {pets.map((pet) => (
            <Button
              key={pet.id}
              type='button'
             
              variant='outline'
              onClick={() => applyTagToSelected(pet)}
              className='h-7 rounded-full border-primary/40 bg-primary/10 px-3 text-xs text-primary hover:bg-primary/20'
            >
              {pet.name}
            </Button>
          ))}
          <Button
            type='button'
           
            variant='ghost'
            onClick={() => setSelected(new Set())}
            className='h-7 rounded-full px-3 text-xs text-muted-foreground'
          >
            선택 해제
          </Button>
        </div>
      )}

      {value.length > 0 && (
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
          {value.map((photo) => {
            const isSelected = selected.has(photo.fileId);
            return (
              <Card
                key={photo.fileId}
                onPointerDown={(e) => handlePointerDown(e, photo.fileId)}
                onPointerEnter={() => handlePointerEnter(photo.fileId)}
                style={{ touchAction: "none" }}
                className={`relative cursor-pointer select-none overflow-hidden rounded-xl border p-0 transition-all ${
                  isSelected ? "border-primary ring-2 ring-primary/50" : ""
                }`}
              >
                <div className='aspect-square w-full flex items-center justify-center overflow-hidden'>
                  {photo.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.previewUrl}
                      alt={photo.label}
                      className='h-full w-full object-cover'
                      draggable={false}
                      loading='lazy'
                      decoding='async'
                    />
                  ) : (
                    <PhotoImage
                      fileId={photo.fileId}
                      alt={photo.label}
                      className='h-full w-full object-cover'
                    />
                  )}
                </div>

                <button
                  type='button'
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(photo.fileId);
                  }}
                  aria-label='사진 삭제'
                  // 아이콘 색을 지정하지 않으면 라이트 테마의 어두운 foreground 를
                  // 물려받아 검은 원 위 검은 X 가 된다.
                  className='absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive'
                >
                  <X className='w-3.5 h-3.5' />
                </button>

                {photo.petIds.length > 0 && (
                  <div className='flex flex-wrap gap-1.5 p-1.5'>
                    {photo.petIds.map((petId) => {
                      const pet = pets.find((p) => p.id === petId);
                      return (
                        <Badge
                          key={petId}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            untagPet(photo.fileId, petId);
                          }}
                          className='cursor-pointer bg-primary-tint text-primary-on-tint hover:bg-primary-tint/70'
                        >
                          {pet?.name ?? petId}
                          <X />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
