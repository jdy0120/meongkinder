"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button, Card, Spinner, Textarea } from "@pawlog/ui";
import { FEED_TAG_SOURCE, PHOTO_CONSENT } from "@pawlog/shared";

import { PetTagChip, type ComposerPhoto, type ComposerTag } from "@/entities/feed";

import { useCaptionDraft } from "../model/useCaptionDraft";
import { useCreateFeedPost } from "../model/useCreateFeedPost";
import { usePhotoUpload } from "../model/usePhotoUpload";
import { useSuggestFeedTags } from "../model/useSuggestFeedTags";

interface FeedComposerProps {
  /** 게시 후 돌아갈 곳 (매장 피드) */
  doneHref: string;
}

/**
 * 피드 업로드 (feature ui).
 *
 *   사진 여러 장 선택 → AI 태그 제안 → 틀리면 탭 한 번으로 수정 → 캡션 → 게시
 *
 * 이 화면의 목표는 **건당 5초**다. 폼 기반 알림장이 20마리 × 1건이라면 여기선 사진 12장이
 * 20마리를 덮으므로, 화면이 한 번이라도 사람을 멈춰 세우면 그 이점이 사라진다.
 *
 * **태그는 사진 한 장 단위**다. 사진을 (드래그로) 골라 놓고 아이 칩을 누르면 고른 사진 전부에
 * 그 아이가 붙는다. 게시물 단위로 태그하면 12장을 한 번에 올릴 때 12장 전부가 태그된 모든
 * 아이에게 가버려서, 초코만 나온 사진이 두부 보호자의 알림장에 들어간다.
 */
export const FeedComposer = ({ doneHref }: FeedComposerProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);
  const dragModeRef = useRef<"add" | "remove">("add");

  const [photos, setPhotos] = useState<ComposerPhoto[]>([]);

  /**
   * 언마운트 시 남은 preview URL 회수 (job-051).
   *
   * `URL.createObjectURL` 은 원본 파일 blob 을 문서 수명 동안 붙잡아 둔다. 여기서는 사진을
   * 12장까지 고르는 화면이라 장당 수 MB 다. 예전에는 **사진을 지우거나 게시에 성공했을
   * 때만** 회수했는데, 실제로 가장 흔한 이탈 경로는 그 둘이 아니다 — 뒤로가기, 다른 탭으로
   * 이동, 게시 실패. 그때마다 고른 사진 전부가 페이지가 살아 있는 내내 메모리에 남았다.
   *
   * 정리 콜백이 최신 목록을 봐야 하므로 ref 로 미러링한다. `[]` 의존성으로 등록한
   * 클로저는 초기 빈 배열을 캡처해서, 상태를 직접 읽으면 아무것도 회수하지 못한다.
   */
  const photosRef = useRef<ComposerPhoto[]>([]);
  // 렌더 중에 ref 를 건드리면 React Compiler 규칙에 걸린다 — effect 에서 동기화한다.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) =>
        URL.revokeObjectURL(photo.previewUrl),
      );
    },
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<ComposerTag[]>([]);
  const [caption, setCaption] = useState("");
  const [aiCaption, setAiCaption] = useState<string | null>(null);

  const upload = usePhotoUpload();
  const suggest = useSuggestFeedTags();
  const captionDraft = useCaptionDraft();
  const createPost = useCreateFeedPost();

  const taggedPetIds = new Set(photos.flatMap((photo) => photo.petIds));
  const tagByPetId = new Map(tags.map((tag) => [tag.petId, tag]));
  // 선택된 사진들에 이미 붙어 있는 아이 (칩의 on/off 상태)
  const selectedPhotos = photos.filter((photo) => selected.has(photo.key));
  const petIdsOnSelection = new Set(
    selectedPhotos.flatMap((photo) => photo.petIds),
  );

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;

    const added = await upload.mutateAsync(files);
    const nextPhotos = [...photos, ...added];
    setPhotos(nextPhotos);
    // 새로 올린 사진을 바로 선택 상태로 둔다 — 대개 방금 찍은 것들에 같은 아이를 붙인다.
    setSelected(new Set(added.map((photo) => photo.key)));

    const result = await suggest.mutateAsync(
      nextPhotos.map((photo) => photo.fileId).filter((id): id is string => !!id),
    );
    if (!result) return;

    const suggestedIds = new Set(result.suggestions.map((item) => item.petId));
    setTags(
      result.candidates.map((candidate) => ({
        petId: candidate.petId,
        petName: candidate.petName,
        profileImageFileId: candidate.profileImageFileId,
        photoConsent: candidate.photoConsent,
        suggested: suggestedIds.has(candidate.petId),
        confidence: candidate.confidence,
        selected: false,
      })),
    );
  };

  /** 선택된 사진 전부에 이 아이를 붙이거나 뗀다 */
  const toggleTag = (petId: string) => {
    if (selectedPhotos.length === 0) return;
    const adding = !petIdsOnSelection.has(petId);

    setPhotos((prev) =>
      prev.map((photo) => {
        if (!selected.has(photo.key)) return photo;
        const has = photo.petIds.includes(petId);
        if (adding && !has) return { ...photo, petIds: [...photo.petIds, petId] };
        if (!adding && has)
          return {
            ...photo,
            petIds: photo.petIds.filter((id) => id !== petId),
          };
        return photo;
      }),
    );
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((photo) => photo.key !== key);
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // ── 드래그 다중 선택 (터치 포함) ────────────────────────────────────────
  const applySelect = (key: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>, key: string) => {
    // 터치 환경에서 브라우저가 포인터를 암묵적으로 캡처하면 다른 카드의 pointerenter 가
    // 발생하지 않아 드래그 다중 선택이 죽는다. 캡처를 풀어 전 카드에서 감지되게 한다.
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    draggingRef.current = true;
    dragModeRef.current = selected.has(key) ? "remove" : "add";
    applySelect(key, dragModeRef.current);
  };

  const handlePointerEnter = (key: string) => {
    if (!draggingRef.current) return;
    applySelect(key, dragModeRef.current);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const requestCaptionDraft = async () => {
    const draft = await captionDraft.mutateAsync([...taggedPetIds]);
    setAiCaption(draft);
    // 이미 손으로 쓴 글이 있으면 덮지 않는다 — 제안은 어디까지나 제안이다.
    if (draft && !caption) setCaption(draft);
  };

  const handleSubmit = async () => {
    const ready = photos.filter((photo) => photo.fileId);
    if (ready.length === 0) return;

    await createPost.mutateAsync({
      caption: caption.trim() || undefined,
      status: "PUBLISHED",
      media: ready.map((photo, index) => ({
        fileId: photo.fileId!,
        order: index,
      })),
      // 제안했지만 사람이 뺀 아이까지 보내야 오인식이 학습 데이터로 남는다.
      suggestedPetIds: tags
        .filter((tag) => tag.suggested)
        .map((tag) => tag.petId),
      tags: ready.flatMap((photo) =>
        photo.petIds.map((petId) => {
          const tag = tagByPetId.get(petId);
          return {
            petId,
            fileId: photo.fileId!,
            // AI 가 제안했는지 / 사람이 직접 골랐는지를 그대로 보낸다. 서버가 이 차이로
            // 오인식 수정 이력을 남기고, 그게 곧 학습 데이터가 된다.
            source: tag?.suggested ? FEED_TAG_SOURCE.AI : FEED_TAG_SOURCE.MANUAL,
            confidence: tag?.suggested ? (tag.confidence ?? undefined) : undefined,
            confirmed: true,
          };
        }),
      ),
    });

    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    router.push(doneHref);
  };

  const busy = upload.isPending || createPost.isPending;
  // 한 사진에 다른 아이와 함께 태그된 비공개 아이가 있으면 서버가 발행을 막는다.
  const consentConflict = photos.some((photo) => {
    if (photo.petIds.length <= 1) return false;
    return photo.petIds.some(
      (petId) => tagByPetId.get(petId)?.photoConsent === PHOTO_CONSENT.PRIVATE,
    );
  });

  return (
    <div
      className='space-y-5'
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* ── 1. 사진 ─────────────────────────────────────────────── */}
      <section className='space-y-3'>
        <div className='flex gap-2'>
          <Button
            type='button'
            className='flex-1 gap-1.5'
            disabled={upload.isPending}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className='size-4' />
            사진 찍기
          </Button>
          <Button
            type='button'
            variant='outline'
            className='flex-1 gap-1.5'
            disabled={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className='size-4' />
            앨범에서 고르기
          </Button>
        </div>

        <input
          ref={cameraInputRef}
          type='file'
          accept='image/*'
          capture='environment'
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* 진행 상황이 안 보이면 멈춘 줄 알고 앱을 닫는다. */}
        {upload.progress && (
          <div className='flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            사진 업로드 중… {upload.progress.done}/{upload.progress.total}장
          </div>
        )}

        {photos.length > 0 && (
          <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
            {photos.map((photo) => {
              const isSelected = selected.has(photo.key);
              return (
                <Card
                  key={photo.key}
                  onPointerDown={(e) => handlePointerDown(e, photo.key)}
                  onPointerEnter={() => handlePointerEnter(photo.key)}
                  style={{ touchAction: "none" }}
                  className={`relative cursor-pointer select-none overflow-hidden rounded-xl p-0 transition-all ${
                    isSelected ? "border-primary ring-2 ring-primary/50" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt={photo.name}
                    className='aspect-square w-full object-cover'
                    draggable={false}
                  />
                  <button
                    type='button'
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(photo.key);
                    }}
                    aria-label='사진 빼기'
                    className='absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive'
                  >
                    <X className='size-3.5' />
                  </button>

                  {/* 이 사진에 누가 붙었는지 사진 위에서 바로 보여야 한다 — 안 보이면 확인하러
                      화면을 옮겨 다니게 되고 그만큼 느려진다. */}
                  {photo.petIds.length > 0 && (
                    // job-052: 10px 글자를 15px 하한(§2.2)에 맞췄다. 사진 위 칩이라 작게
                    // 두고 싶은 유혹이 있지만, 태그가 맞는지 확인하려고 보는 것이라
                    // 안 읽히면 존재 이유가 없다.
                    <div className='absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-1.5'>
                      {photo.petIds.map((petId) => (
                        <span
                          key={petId}
                          className='rounded-pill bg-surface/90 px-2 text-label font-semibold text-foreground'
                        >
                          {tagByPetId.get(petId)?.petName ?? petId}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. 태그 ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section className='space-y-2'>
          <div className='flex items-center gap-1.5'>
            <h2 className='text-sm font-semibold'>
              {selectedPhotos.length > 0
                ? `선택한 ${selectedPhotos.length}장에 누가 있나요?`
                : "사진을 골라주세요"}
            </h2>
            {suggest.isPending && <Spinner className='size-4 text-primary' />}
          </div>
          <p className='text-xs text-muted-foreground'>
            사진을 눌러(끌어서 여러 장) 고른 뒤 아이를 선택하면 그 사진들에 함께 붙어요. 오늘 등원한
            아이만 보여드리고,
            <Sparkles className='mx-1 inline size-3 text-primary' />
            표시는 AI 추천이니 맞는지 확인해주세요.
          </p>

          {tags.length === 0 && !suggest.isPending ? (
            <p className='rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground'>
              오늘 등원 예정인 아이가 없어요. 출석부에서 먼저 확인해주세요.
            </p>
          ) : (
            <div
              className={`flex flex-wrap gap-2 ${
                selectedPhotos.length === 0 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {tags.map((tag) => (
                <PetTagChip
                  key={tag.petId}
                  tag={{ ...tag, selected: petIdsOnSelection.has(tag.petId) }}
                  // 고른 사진 중 한 장이라도 다른 아이가 이미 있으면 비공개 아이는 잠긴다.
                  groupPhoto={selectedPhotos.some(
                    (photo) =>
                      photo.petIds.filter((id) => id !== tag.petId).length > 0,
                  )}
                  onToggle={toggleTag}
                />
              ))}
            </div>
          )}

          {consentConflict && (
            <p className='rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive'>
              비공개 동의 아이는 혼자 나온 사진에만 태그할 수 있어요. 해당 사진의 태그를
              확인해주세요.
            </p>
          )}
        </section>
      )}

      {/* ── 3. 캡션 ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section className='space-y-2'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-semibold'>한 줄 남기기</h2>
            <Button
              type='button'
             
              variant='ghost'
              className='gap-1.5 text-xs'
              disabled={taggedPetIds.size === 0 || captionDraft.isPending}
              onClick={() => void requestCaptionDraft()}
            >
              <Sparkles className='size-3.5' />
              AI 추천
            </Button>
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder='비워두면 AI가 대신 써드려요.'
            rows={3}
            className='rounded-xl'
          />
          {aiCaption && caption !== aiCaption && (
            <p className='text-xs text-muted-foreground'>AI 추천: {aiCaption}</p>
          )}
        </section>
      )}

      {/* ── 4. 게시 ─────────────────────────────────────────────── */}
      <Button
        type='button'
        size='lg'
        className='w-full gap-1.5'
        disabled={busy || photos.length === 0 || consentConflict}
        onClick={() => void handleSubmit()}
      >
        {createPost.isPending && <Loader2 className='size-4 animate-spin' />}
        {taggedPetIds.size > 0
          ? `${taggedPetIds.size}명의 보호자에게 보내기`
          : "올리기"}
      </Button>
    </div>
  );
};
