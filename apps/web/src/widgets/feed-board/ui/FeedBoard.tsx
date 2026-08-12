"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Camera } from "lucide-react";
import { Button, Card, Spinner } from "@pawlog/ui";

import { EmptyState } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { useInfiniteList } from "@/shared/libs/query/useInfiniteList";
import { FeedPostCard, type FeedPostDetail } from "@/entities/feed";

/**
 * 매장 피드 (widget) — 오늘 올라온 사진을 최신순으로 보여준다.
 * 목록 질의와 페이지네이션 상태를 자체 소유한다.
 */
export const FeedBoard = () => {
  // 빈 상태에서 "사진 올리기"로 바로 보내려면 매장 세그먼트가 필요하다 (CLAUDE.md §8-5).
  const { tenant } = useParams<{ tenant: string }>();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteList<FeedPostDetail>("feed-posts", "/v1/feed/posts", {
      pageSize: 10,
      sort: "createdAt",
      order: "desc",
    });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Spinner className='size-8 text-primary' />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title='아직 올라온 사진이 없어요'
        description='노는 중에 한 장 찍어 올리면 태그된 아이의 보호자에게 바로 갑니다.'
        action={
          <Button asChild>
            <Link href={tenantPath(tenant, "feed", "new")}>사진 올리기</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className='space-y-4'>
      {posts.map((post) => (
        <FeedPostCard key={post.id} post={post} />
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
    </div>
  );
};
