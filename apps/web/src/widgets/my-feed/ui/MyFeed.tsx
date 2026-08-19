"use client";

import Link from "next/link";

import { useState } from "react";
import { PawPrint } from "lucide-react";
import { Button } from "@pawlog/ui";

import { EmptyState, ListSkeleton } from "@/shared/ui";
import { useInfiniteList } from "@/shared/libs/query/useInfiniteList";
import { usePets } from "@/entities/pet";
import { FeedPostCard, type MyFeedPost } from "@/entities/feed";

/**
 * 보호자 피드 (widget) — 내 아이가 태그된 사진만.
 *
 * 기본 화면을 전체 원 피드로 두지 않는 것이 의도다. 보호자는 장수를 센다 — "우리 애 3장,
 * 옆집 애 12장"은 어린이집에서 흔한 클레임 패턴이고, 그게 곧 원장이 이 제품을 부담스러워하는
 * 이유가 된다. 대신 단체 사진 한 장이 여러 보호자에게 각자 "우리 아이 사진"으로 잡히므로,
 * 우리 아이가 등장하는 사진 수는 오히려 늘어난다.
 */
export const MyFeed = () => {
  const [petId, setPetId] = useState<string | null>(null);
  const { data: pets = [] } = usePets();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteList<MyFeedPost>("my-feed", "/v1/feed/mine", {
      pageSize: 10,
      order: "desc",
      ...(petId ? { petId } : {}),
    });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className='space-y-4'>
      {/* 아이가 둘 이상일 때만 고르는 의미가 있다. */}
      {pets.length > 1 && (
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
           
            variant={petId === null ? "default" : "outline"}
            className='rounded-full'
            onClick={() => setPetId(null)}
          >
            전체
          </Button>
          {pets.map((pet) => (
            <Button
              key={pet.id}
              type='button'
             
              variant={petId === pet.id ? "default" : "outline"}
              className='rounded-full'
              onClick={() => setPetId(pet.id)}
            >
              {pet.name}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <ListSkeleton variant='card' count={3} label='우리 아이 사진 불러오는 중' />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title='아직 사진이 없어요'
          description='유치원에서 우리 아이가 나온 사진을 올리면 여기에 바로 나타나요. 아이가 등록돼 있는지 먼저 확인해보세요.'
          action={
            <Button asChild variant='outline'>
              <Link href='/pet'>아이 정보 보기</Link>
            </Button>
          }
        />
      ) : (
        <>
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              highlightPetIds={post.myPets.map((pet) => pet.id)}
            />
          ))}

          {hasNextPage && (
            <Button
              type='button'
              variant='outline'
              className='w-full'
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "불러오는 중…" : "더보기"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
