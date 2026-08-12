"use client";

import Link from "next/link";
import {
  ChevronRight,
  Images,
  Newspaper,
  PawPrint,
  Store,
  UserRound,
} from "lucide-react";
import { Button, Card, CardContent } from "@pawlog/ui";

import { EmptyState, SectionHeading, StatTile } from "@/shared/ui";
import { usePets } from "@/entities/pet";
import { useMyPetTickets } from "@/entities/subscription";
import { TodayReportSection } from "@/widgets/today-report";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 바로가기는 **최대 4개**(design-system.md §7). 그 이상은 위계가 없다는 뜻이라
 * 하단 탭이나 하위 화면으로 내린다.
 */
const SHORTCUTS = [
  { href: "/feed", label: "사진", icon: Images },
  { href: "/reports", label: "알림장", icon: Newspaper },
  { href: "/pet", label: "아이 정보", icon: PawPrint },
  { href: "/tenants", label: "내 매장", icon: Store },
] as const;

/**
 * 보호자 홈 (view) — job-048 정보위계 재설계.
 *
 * ## 무엇을 바꿨나
 *
 * 예전에는 바로가기 카드 4장이 전부였다. 그건 앱이 아니라 **메뉴판**이다 — 보호자가 이 앱을
 * 여는 이유는 "우리 애 오늘 어땠나"이지 메뉴를 고르러 오는 게 아니다. 단톡방을 이기려면
 * 단톡방을 열었을 때처럼 **바로 오늘 소식이 보여야** 한다(design-system.md §0, §7).
 *
 * 그래서 순서를 뒤집었다:
 *   1. 오늘의 알림장 — 이 화면에 온 이유
 *   2. 남은 횟수 — 확인하러 오는 두 번째 값. 0회면 경고색으로 미리 알린다(job-045)
 *   3. 바로가기 — 나머지
 *
 * 아이가 없으면 위 둘은 보여줄 게 없으므로 **등록 안내 하나로 대체**한다. 신규 사용자가
 * 처음 보는 화면이 빈 격자가 되지 않게 하는 것이 이 화면의 가장 중요한 상태다(§6).
 */
export const AppPage = () => {
  const { data: pets, isLoading: isLoadingPets } = usePets();
  const { data: tickets } = useMyPetTickets();

  const hasPet = (pets ?? []).length > 0;
  const hasEmptyTicket = (tickets ?? []).some((ticket) => ticket.balance <= 0);

  return (
    <div className='flex min-h-screen flex-col bg-background'>
      <header className='flex items-center justify-between px-5 py-4'>
        <div className='flex items-center gap-2 text-lg font-bold text-primary'>
          <PawPrint className='size-5' />
          Pawlog Kids
        </div>
        {/* 내 정보로 가는 유일한 입구. 하단 탭은 5개가 상한이라 여기 둔다(§8). */}
        <Button
          asChild
          variant='ghost'
          size='icon'
          aria-label='내 정보'
          className='size-11 rounded-full'
        >
          <Link href='/profile'>
            <UserRound className='size-5' />
          </Link>
        </Button>
      </header>

      <main className='mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-10'>
        {!isLoadingPets && !hasPet ? (
          <EmptyState
            icon={PawPrint}
            title='아직 등록된 아이가 없어요'
            description='아이를 등록하면 유치원에서 보내는 알림장과 사진을 여기서 볼 수 있어요. 이미 유치원에 다니고 있다면 등록해 둔 번호로 자동 연결됩니다.'
            action={
              <Button asChild>
                <Link href='/pet'>아이 등록하기</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* ① 이 화면에 온 이유 */}
            <section className='space-y-3'>
              <SectionHeading
                action={
                  <Link
                    href='/reports'
                    className='flex items-center text-xs text-muted-foreground'
                  >
                    전체 보기
                    <ChevronRight className='size-3.5' />
                  </Link>
                }
              >
                오늘의 알림장
              </SectionHeading>
              <TodayReportSection />
            </section>

            {/* ② 확인하러 오는 두 번째 값 — 0회는 미리 알려야 현장에서 당황하지 않는다 */}
            {(tickets ?? []).length > 0 && (
              <section className='space-y-3'>
                <SectionHeading
                  action={
                    <Link
                      href='/subscriptions'
                      className='flex items-center text-xs text-muted-foreground'
                    >
                      내역
                      <ChevronRight className='size-3.5' />
                    </Link>
                  }
                >
                  남은 횟수
                </SectionHeading>
                <div className='flex flex-col gap-3'>
                  {tickets?.map((ticket) => (
                    <StatTile
                      key={ticket.petId}
                      label={ticket.petName}
                      value={ticket.balance}
                      unit='회'
                      tone={ticket.balance <= 0 ? "critical" : "default"}
                    />
                  ))}
                </div>
                {hasEmptyTicket && (
                  <p className='break-keep text-xs text-destructive'>
                    남은 횟수가 없어요. 유치원에 충전을 요청해주세요.
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {/* ③ 나머지 — 최대 4개 (§7) */}
        <section className='space-y-3'>
          <SectionHeading>바로가기</SectionHeading>
          <div className='grid grid-cols-2 gap-3'>
            {SHORTCUTS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Card className='transition hover:bg-muted/40'>
                  <CardContent className='flex items-center gap-3 p-4'>
                    <Icon className='size-5 shrink-0 text-primary' />
                    <span className='text-sm font-medium'>{label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MobileNav />
    </div>
  );
};
