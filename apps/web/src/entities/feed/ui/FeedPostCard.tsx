"use client";

import { useState } from "react";
import { Badge, Card } from "@pawlog/ui";

import { PhotoImage } from "@/entities/file";
import { PhotoCarousel } from "@/shared/ui";

import type { FeedPostDetail } from "../model/types";

interface FeedPostCardProps {
  post: FeedPostDetail;
  /** 이 게시물에서 "내 아이"로 강조할 pet id 들 (보호자 피드에서 사용) */
  highlightPetIds?: string[];
  footer?: React.ReactNode;
}

const formatWhen = (post: FeedPostDetail) => {
  const at = post.publishedAt ?? post.createdAt;
  return new Date(at).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * 피드 게시물 카드 (entity ui) — 사진 + 캡션 + 태그된 아이.
 *
 * 매장 피드와 보호자 피드가 같은 카드를 쓴다. 둘의 차이는 데이터가 아니라 **무엇을 강조하는가**
 * 뿐이라(보호자 화면에선 내 아이 태그가 앞에 오고 강조된다) `highlightPetIds` 하나로 갈린다.
 *
 * 사진은 그리드가 아니라 **한 장씩 넘기는 캐러셀**이다(`PhotoCarousel` 주석 참고). 그리고
 * 태그 칩은 게시물 전체가 아니라 **지금 보고 있는 사진**의 것을 보여준다 — 태그는 원래
 * 사진 단위로 붙는데(`FeedTag.mediaId`) 합쳐서 한 줄로 그리면, 초코만 나온 사진을 보는
 * 동안 두부·콩이 이름이 나란히 붙어 "이 사진에 우리 애가 있다"는 잘못된 읽기를 만든다.
 */
export const FeedPostCard = ({
  post,
  highlightPetIds = [],
  footer,
}: FeedPostCardProps) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const highlighted = new Set(highlightPetIds);

  const caption = post.caption || post.aiCaptionDraft;

  // 사진이 있으면 그 사진의 태그, 없으면(사진 없는 게시물) 게시물 전체 태그.
  const current = post.media[mediaIndex];
  // 내 아이를 앞으로 — 단체 사진 한 장이 보호자에게는 "우리 아이 사진"으로 읽혀야 한다.
  const tags = [...(current ? current.tags : post.tags)].sort((a, b) => {
    const score = (petId: string) => (highlighted.has(petId) ? 0 : 1);
    return score(a.petId) - score(b.petId);
  });

  return (
    <Card className='overflow-hidden rounded-2xl p-0'>
      {post.media.length > 0 && (
        <PhotoCarousel
          items={post.media}
          label='피드 사진'
          onIndexChange={setMediaIndex}
          render={(item) => (
            <PhotoImage
              fileId={item.fileId}
              alt={caption ?? "피드 사진"}
              className='aspect-square w-full object-cover'
            />
          )}
        />
      )}

      <div className='space-y-2 p-4'>
        <div className='flex flex-wrap gap-1.5'>
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant={highlighted.has(tag.petId) ? "default" : "outline"}
              className='rounded-full text-xs'
            >
              {tag.pet.name}
            </Badge>
          ))}
          {tags.length === 0 && (
            <span className='text-xs text-muted-foreground'>
              태그된 아이가 없어요
            </span>
          )}
        </div>

        {caption && <p className='text-sm leading-relaxed'>{caption}</p>}

        <p className='text-xs text-muted-foreground'>{formatWhen(post)}</p>

        {footer}
      </div>
    </Card>
  );
};
