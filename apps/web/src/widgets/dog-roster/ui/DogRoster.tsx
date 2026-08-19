"use client";

import { useMemo, useState } from "react";
import { PawPrint, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Label } from "@pawlog/ui";
import {
  BADGE_LEVEL,
  type PetSummaryResponse,
  type PetWithOwner,
} from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import { EmptyState, ListSkeleton, SegmentedControl, type SegmentOption } from "@/shared/ui";
import { DogCard, resolvePetSafety } from "@/entities/pet";
import { CheckInButton } from "@/features/attendance/check-in";
import { SellTicketDialog } from "@/features/subscription/sell-ticket";
import { CheckOutButton } from "@/features/attendance/check-out";
import { PetIntakeDialog } from "@/features/pet/intake-pet";
import { PetDetailSheet } from "./PetDetailSheet";

/**
 * 원생 목록 (design-system.md §6.1).
 *
 * ## 표가 아니라 카드인 이유
 *
 * 예전에는 8열짜리 표였다(이름·종·나이·체중·중성화·보호자·케어노트·작업). 모바일에서는
 * 가로 스크롤이 생겨 **한 아이의 정보를 보려면 좌우로 밀어야 했고**, 그 상태로는 알러지도
 * 접종 만료도 화면 밖에 있었다. 이 화면은 사무실 책상이 아니라 현관에서 쓰인다.
 *
 * ## 무엇을 표면에 올리는가
 *
 * 카드에 담을 정보를 '조회용'과 '사고 예방용'으로 나누고 **사고 예방용만** 올린다.
 * 체중·생일·보호자 주소는 상세 시트로 내려도 되지만, 알러지·공격성·접종 만료는 한 뎁스만
 * 숨겨도 급할 때 놓치고, 이 부류는 놓치면 사후 확인이 무의미하다.
 *
 * ## 기본 정렬은 픽업 시각이다 (이름순이 아니다)
 *
 * 서버가 정한다(`AdminService.PET_DEFAULT_SORT`). 유치원은 등하원 시각이 제각각이고
 * 15~18시가 가장 혼잡해서, 픽업 시각 순 목록이 그대로 오후 작업 순서표가 된다.
 * 이름으로 찾는 일은 검색창이 대체한다.
 */

type FilterValue = "all" | "checkedIn" | "scheduled" | "checkedOut" | "attention";

const PAGE_SIZE = 20;

export const DogRoster = () => {
  const tenantId = useTenantStore((state) => state.tenantId);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [openPetId, setOpenPetId] = useState<string | null>(null);

  const { data, isLoading } = usePaginatedList<PetWithOwner>(
    "pets",
    "/v1/admin/pets",
    { page, pageSize: PAGE_SIZE, search },
  );

  /**
   * 필터 칩의 개수는 **매장 전체** 기준이라 목록 응답에서 셀 수 없다 — 목록은
   * 페이지네이션이라 "이 페이지의 등원 중 3마리"가 나오고, 그건 필터로서 의미가 없다.
   */
  const { data: summary } = useQuery({
    queryKey: ["pet-summary", tenantId],
    queryFn: async () => {
      const res = await Get<PetSummaryResponse, undefined>(
        "/v1/admin/pets/summary",
      );
      return res.data.data;
    },
  });

  const options: SegmentOption<FilterValue>[] = [
    { value: "all", label: "전체", count: summary?.total },
    { value: "checkedIn", label: "등원 중", count: summary?.present },
    { value: "scheduled", label: "등원 예정", count: summary?.scheduled },
    { value: "checkedOut", label: "하원 완료", count: summary?.checkedOut },
    {
      value: "attention",
      label: "주의",
      count: summary?.attention,
      tone: "caution",
    },
  ];

  // 필터는 현재 페이지 안에서만 건다. 개수는 전체 기준이라 칩의 숫자와 보이는 카드 수가
  // 다를 수 있는데, 그게 페이지네이션의 정직한 모습이다(칩을 페이지 기준으로 바꾸면
  // 이번엔 "주의 0" 인데 다음 페이지에 주의 아이가 있는 상태가 된다).
  const pets = useMemo(() => {
    const items = data?.items ?? [];
    if (filter === "all") return items;

    return items.filter((pet) => {
      const status = pet.attendances[0]?.status;
      switch (filter) {
        case "checkedIn":
          return status === "CHECKED_IN";
        case "scheduled":
          return status === "SCHEDULED";
        case "checkedOut":
          return status === "CHECKED_OUT";
        case "attention":
          return resolvePetSafety(pet).level !== BADGE_LEVEL.NORMAL;
      }
    });
  }, [data?.items, filter]);

  const openPet = pets.find((pet) => pet.id === openPetId) ?? null;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className='space-y-6'>
      <form onSubmit={handleSearch} role='search' className='flex gap-2'>
        <Label htmlFor='roster-search' className='sr-only'>
          아이 이름 또는 보호자 검색
        </Label>
        <Input
          id='roster-search'
          type='search'
          placeholder='아이 이름 또는 보호자'
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button type='submit' aria-label='검색'>
          <Search />
        </Button>
      </form>

      <SegmentedControl
        label='원생 목록 필터'
        options={options}
        value={filter}
        onChange={(next) => setFilter(next)}
      />

      {isLoading ? (
        // 스피너는 화면 중앙이 아니라 **콘텐츠가 들어올 자리**에 둔다 (§6).
        <ListSkeleton variant='card' count={5} label='원생 목록 불러오는 중' />
      ) : pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title={
            filter === "all"
              ? "등록된 아이가 없어요"
              : "이 조건에 해당하는 아이가 없어요"
          }
          description={
            filter === "all"
              ? "보호자 전화번호만 있으면 등록할 수 있어요. 가입하지 않은 보호자도 그날부터 알림톡을 받습니다."
              : "다른 필터를 눌러 보세요."
          }
          action={filter === "all" ? <PetIntakeDialog /> : undefined}
        />
      ) : (
        // job-053: 데스크톱에서 본문 폭 제한이 풀리므로(`PageShell desktopWide`) 열도 함께
        // 늘린다. 2열로 두면 1920px 에서 카드 하나가 800px 이 되어, 아바타 60px 과 배지
        // 몇 개가 왼쪽에 몰리고 오른쪽 절반이 빈다 — 넓어진 만큼 한 화면에 더 보이는 게
        // 목적이지 카드가 커지는 게 목적이 아니다. `md` 이하는 손대지 않는다.
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
          {pets.map((pet) => (
            <DogCard.Root
              key={pet.id}
              pet={pet}
              onOpen={() => setOpenPetId(pet.id)}
              action={<RosterAction pet={pet} />}
            >
              <DogCard.Head />
              <DogCard.Badges />
              <DogCard.Footer />
            </DogCard.Root>
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className='flex items-center justify-between gap-3 border-t pt-4'>
          <span className='text-label text-muted-foreground'>
            {page} / {data.meta.totalPages} 페이지 · 총 {data.meta.total}마리
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              이전
            </Button>
            <Button
              variant='outline'
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 상세는 페이지 이동이 아니라 시트다 — 목록 스크롤 위치를 잃지 않는다 (§3.2). */}
      <PetDetailSheet
        pet={openPet}
        open={openPetId !== null}
        onOpenChange={(open) => !open && setOpenPetId(null)}
      />
    </div>
  );
};

/**
 * 카드 우측 64px 슬롯. 오늘의 출석 상태에 따라 등원/하원 버튼이 **같은 자리에서** 바뀐다.
 *
 * 오늘 스케줄이 아닌 아이는 출석 기록이 없어 버튼도 없다 — 그때 등원시키려면 출석부에서
 * 임시 등원을 만들어야 하고, 그게 "오늘 안 오는 날인데 왔다"의 정직한 처리다.
 */
const RosterAction = ({ pet }: { pet: PetWithOwner }) => {
  const attendance = pet.attendances[0];
  if (!attendance) return null;

  if (attendance.status === "SCHEDULED") {
    return (
      <CheckInButton
        fill
        attendanceId={attendance.id}
        petName={pet.name}
        // 접종이 만료됐어도 **막지 않는다** — 확인 시트를 띄우고 원장이 알고 누르게 한다.
        expiredVaccinationTypes={resolvePetSafety(pet).expiredVaccinations.map(
          (vaccination) => vaccination.type,
        )}
        // job-063: 잔액 0도 같은 방식이다(막지 않고 알린다). 판매는 feature 끼리 import 할
        // 수 없어 widget 인 여기서 끼워 넣는다.
        passRemaining={pet.passRemaining}
        sellAction={<SellTicketDialog petId={pet.id} petName={pet.name} />}
      />
    );
  }

  if (attendance.status === "CHECKED_IN") {
    return (
      <CheckOutButton fill attendanceId={attendance.id} petName={pet.name} />
    );
  }

  return null;
};
