"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";
import { Button, Card, Spinner } from "@pawlog/ui";
import type { FeedCoverageResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/**
 * "오늘 사진 0장인 아이" 알림 (widget) — 원장 화면의 필수 방어 장치.
 *
 * 폼 기반 알림장은 20마리를 순서대로 채우니 누락이 구조적으로 없다. 피드는 안 찍히면 그냥
 * 빠진다. 그 자유도의 대가를 이 위젯이 메운다 — **이게 없으면 "우리 애만 사진이 없다"는
 * 클레임이 터지고**, 편해지라고 판 제품이 컴플레인을 늘리는 순간 해지 사유가 된다.
 */
export const PhotoGapAlert = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const tenantId = useTenantStore((state) => state.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ["feed-coverage", tenantId],
    queryFn: async () => {
      const res = await Get<FeedCoverageResponse, undefined>(
        "/v1/feed/coverage",
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <Card className='flex items-center justify-center py-8'>
        <Spinner className='size-6 text-primary' />
      </Card>
    );
  }

  if (!data || data.totalPets === 0) return null;

  const allCovered = data.missing.length === 0;

  return (
    <Card
      // job-052: 팔레트 밖 색(emerald/amber) → 토큰. 사진이 빠진 상태는 '주의'이고,
      // 다 채운 상태는 '정상'이다 — 이미 §3.1 이 이름 붙여 둔 두 레벨 그대로다.
      className={`gap-3 rounded-card p-5 ${
        allCovered
          ? "border-transparent bg-primary-tint text-primary-on-tint"
          : "border-transparent bg-caution-tint text-caution-text"
      }`}
    >
      <div className='flex items-start gap-2'>
        {allCovered ? (
          <CheckCircle2 className='mt-0.5 size-5 shrink-0' />
        ) : (
          <AlertTriangle className='mt-0.5 size-5 shrink-0' />
        )}
        <div className='min-w-0 flex-1 space-y-1'>
          <p className='text-body font-semibold'>
            {allCovered
              ? `오늘 등원한 ${data.totalPets}마리 모두 사진이 있어요`
              : `오늘 사진 0장: ${data.missing.length}마리`}
          </p>
          {!allCovered && (
            <p className='break-keep text-body opacity-90'>
              {data.missing.map((pet) => pet.petName).join(", ")}
            </p>
          )}
          <p className='text-label opacity-80'>
            오늘 사진 {data.postCount}건 · 등원 {data.totalPets}마리
          </p>
        </div>
      </div>

      {!allCovered && (
        <Button asChild size='lg' className='w-full'>
          <Link href={tenantPath(tenant, "feed", "new")}>
            <Camera />
            지금 찍기
          </Link>
        </Button>
      )}
    </Card>
  );
};
