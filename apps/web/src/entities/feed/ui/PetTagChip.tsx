"use client";

import { Check, Lock, Sparkles } from "lucide-react";

import { canTagInGroupPhoto } from "../lib/photoConsent";
import type { ComposerTag } from "../model/types";

interface PetTagChipProps {
  tag: ComposerTag;
  /** 지금 태그된 아이가 2마리 이상이 되는 상황인지 — 비공개 아이는 그때 잠긴다 */
  groupPhoto: boolean;
  onToggle: (petId: string) => void;
}

/**
 * 태그 후보 한 마리 칩 (entity ui).
 *
 * 탭 한 번으로 켜고 끈다 — AI 제안이 틀렸을 때 고치는 비용이 이 한 번을 넘으면 사람은
 * 그냥 손으로 다 하는 쪽을 택한다.
 *
 * 초상권 미동의(비공개) 아이는 **다른 아이가 함께 태그된 순간** 회색으로 잠긴다. 서버도
 * 발행 시점에 막지만, 다 만들고 나서 거절당하는 것보다 누를 수 없는 편이 낫다.
 */
export const PetTagChip = ({ tag, groupPhoto, onToggle }: PetTagChipProps) => {
  const locked = groupPhoto && !tag.selected && !canTagInGroupPhoto(tag.photoConsent);

  return (
    <button
      type='button'
      disabled={locked}
      onClick={() => onToggle(tag.petId)}
      aria-pressed={tag.selected}
      title={
        locked
          ? "초상권 동의 범위가 '비공개'라 다른 아이와 함께 찍힌 사진에 태그할 수 없어요."
          : undefined
      }
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        tag.selected
          ? "border-primary bg-primary text-primary-foreground"
          : locked
            ? "cursor-not-allowed border-dashed border-muted bg-muted/40 text-muted-foreground opacity-60"
            : "border-border bg-background hover:bg-accent"
      }`}
    >
      {tag.selected && <Check className='size-3.5' />}
      {locked && <Lock className='size-3.5' />}
      {tag.petName}
      {tag.suggested && !tag.selected && !locked && (
        <Sparkles className='size-3.5 text-primary' aria-label='AI 제안' />
      )}
    </button>
  );
};
