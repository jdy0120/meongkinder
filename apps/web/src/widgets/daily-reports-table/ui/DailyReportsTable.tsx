"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronDown, Pencil } from "lucide-react";
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { EmptyState } from "@/shared/ui";
import { usePetOptions } from "@/entities/pet";
import { PhotoImage } from "@/entities/file";
import {
  DailyReportStatusBadge,
  getPhotoContents,
  type DailyReportWithContents,
} from "@/entities/daily-report";

/**
 * 일일 리포트 목록 위젯 — **하루치**를 보여준다.
 *
 * ## 기본값이 오늘인 이유
 *
 * 예전에는 전체를 최신순으로 나열했는데, 그러면 첫 페이지가 어제와 오늘이 섞인 10건이 되어
 * "오늘 누구 것이 아직 안 나갔나"를 셀 수가 없다. 리포트는 그날 안에 끝나는 일이라
 * **하루가 작업 단위**다. 날짜를 좁히면 목록 길이가 원생 수를 넘지 않아 한눈에 들어온다.
 *
 * 지난 날은 **날짜 제목을 눌러** 캘린더에서 고른다. 검색이나 더보기로 거슬러 올라가게 하면
 * "지난 화요일"을 찾는 데 몇 번을 눌러야 하는지 알 수 없다.
 *
 * ## 캘린더를 상시 노출하지 않는 이유
 *
 * 예전에는 목록 오른쪽(좁은 화면에서는 목록 **위**)에 캘린더 카드를 항상 띄웠다. 그런데 이
 * 화면에 들어오는 이유는 거의 언제나 오늘 것을 보려는 것이고, 날짜를 바꾸는 건 가끔 있는
 * 일이다. 상시 노출하면 늘 하는 일(오늘 목록)이 가끔 하는 일(날짜 고르기) 아래로 밀린다 —
 * 모바일에서는 한 달 격자를 지나야 첫 번째 리포트가 나왔다.
 *
 * 그래서 **지금 보고 있는 날짜 자체가 트리거**다. 바꿀 대상과 누를 곳이 같아서 따로 찾을
 * 필요가 없고, 안 쓸 때는 자리를 차지하지 않는다.
 *
 * ⚠️ 캘린더에 **리포트가 있는 날 표시는 없다.** 목록 API 가 하루 단위 필터만 받아서
 * (`date`), 월 단위 집계를 하려면 기간 조회를 새로 만들어야 한다. 없는 상태에서 점을
 * 찍으면 그게 곧 거짓말이 되므로 아예 찍지 않았다.
 */
export const DailyReportsTable = () => {
  // 매장 경로(/tenant/<subdomain>/…)를 유지한다.
  const { tenant } = useParams<{ tenant: string }>();
  const [date, setDate] = useState<Date>(() => new Date());
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = new Date();
  const isToday = isSameDay(date, today);

  const { data, isLoading } = usePaginatedList<DailyReportWithContents>(
    "daily-reports",
    "/v1/daily-reports",
    {
      page,
      pageSize: 10,
      sort: "date",
      order: "desc",
      // 서버의 `date` 는 `@db.Date` 라 하루 = 값 하나다. 타임존이 붙은 ISO 문자열을
      // 보내면 KST 에서 하루가 밀리므로 **로컬 달력 기준 YYYY-MM-DD** 만 보낸다.
      date: format(date, "yyyy-MM-dd"),
    },
  );
  const { data: pets = [] } = usePetOptions();
  const petNameById = Object.fromEntries(pets.map((pet) => [pet.id, pet.name]));

  const selectDate = (next: Date) => {
    setDate(next);
    setPage(1); // 날짜가 바뀌면 3페이지에 머물러 있을 이유가 없다.
    // 고르는 순간 닫는다 — 날짜 하나를 고르는 팝오버라 확인 버튼을 둘 이유가 없고,
    // 열린 채로 두면 바뀐 목록이 팝오버에 가려 결과를 못 본다.
    setPickerOpen(false);
  };

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className='flex flex-wrap items-center justify-between gap-3 pb-3'>
        {/* 날짜 제목이 곧 날짜 선택 버튼이다. 눌러야 캘린더가 열린다. */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              aria-label={`${format(date, "M월 d일", { locale: ko })} — 날짜 변경`}
              /* `-ml-3` 로 안쪽 여백을 상쇄해 글자가 카드 왼쪽 선에 그대로 맞는다.
                 `min-h-touch` 는 두 줄짜리 내용이라 높이를 auto 로 풀어도 터치 타겟
                 64px 이 유지되게 한다(design-system.md §8). */
              className='-ml-3 h-auto min-h-touch flex-col items-start justify-center gap-0.5 px-3 py-2'
            >
              <span className='flex items-center gap-2 text-name'>
                {format(date, "M월 d일 (E)", { locale: ko })}
                <ChevronDown className='size-4 text-muted-foreground' />
              </span>
              <span className='text-label font-normal text-muted-foreground'>
                {isToday ? "오늘" : "지난 날짜"} · {data?.meta.total ?? 0}건
              </span>
            </Button>
          </PopoverTrigger>

          {/* 기본 `w-72` 는 한 달 격자(7 × 44px)보다 좁아 잘린다 — 내용 폭에 맡긴다. */}
          <PopoverContent align='start' className='w-auto p-2'>
            <Calendar
              mode='single'
              required
              selected={date}
              onSelect={selectDate}
              locale={ko}
              // 아직 오지 않은 날의 리포트는 존재할 수 없다.
              disabled={{ after: today }}
              /*
               * 기본 셀 28px 은 손가락으로 못 누른다. 그렇다고 터치 타겟 64px 을 그대로
               * 적용하면 한 달 격자가 448px 이라 팝오버가 화면을 덮는다 — 달력은
               * 격자 자체가 밀도를 강제하는 예외라 44px 로 타협한다.
               */
              className='[--cell-size:--spacing(11)] p-0'
            />
          </PopoverContent>
        </Popover>

        {/* 다른 날을 보다가 오늘로 돌아오는 건 가장 잦은 이동이라 한 번에 끝낸다. */}
        {!isToday && (
          <Button variant='outline' onClick={() => selectDate(new Date())}>
            오늘
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Spinner className='size-8 text-primary' />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              isToday
                ? "오늘 작성된 리포트가 없어요"
                : "이 날짜엔 리포트가 없어요"
            }
            description={
              isToday
                ? "사진을 올려 두었다면 하루 마감에서 아이별 리포트가 한 번에 만들어집니다."
                : "위의 날짜를 눌러 다른 날짜를 골라 보세요."
            }
            action={
              isToday ? (
                <Button asChild>
                  <Link href={tenantPath(tenant, "daily-reports", "new")}>
                    리포트 작성
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='font-semibold text-muted-foreground'>
                    아이
                  </TableHead>
                  <TableHead className='font-semibold text-muted-foreground'>
                    사진
                  </TableHead>
                  <TableHead className='font-semibold text-muted-foreground'>
                    상태
                  </TableHead>
                  <TableHead className='font-semibold text-muted-foreground'>
                    총평
                  </TableHead>
                  <TableHead className='text-right font-semibold text-muted-foreground'>
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((report) => {
                  const photos = getPhotoContents(report.contents);
                  const firstPhoto = photos[0];
                  return (
                    <TableRow key={report.id}>
                      <TableCell className='font-medium'>
                        {petNameById[report.petId] ?? report.petId}
                      </TableCell>
                      <TableCell>
                        {firstPhoto?.fileId ? (
                          <div className='flex items-center gap-1.5'>
                            <PhotoImage
                              fileId={firstPhoto.fileId}
                              alt='리포트 사진'
                              className='size-9 rounded-xl border object-cover'
                            />
                            {photos.length > 1 && (
                              <span className='text-label text-muted-foreground'>
                                +{photos.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className='text-label'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DailyReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className='max-w-[280px] truncate text-muted-foreground'>
                        {report.summary || "-"}
                      </TableCell>
                      <TableCell className='text-right'>
                        {/* 데스크톱 콘솔이 아니라 매장 화면이므로 축소하지 않는다
                              (job-052: `size='sm'` 은 apps/web 에서 쓰지 않는다). */}
                        <Button asChild variant='outline'>
                          <Link
                            href={tenantPath(
                              tenant,
                              "daily-reports",
                              report.id,
                              "edit",
                            )}
                          >
                            <Pencil />
                            수정
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <span className='text-label text-muted-foreground'>
              총 {data.meta.total}건 중 {page} / {data.meta.totalPages} 페이지
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
      </CardContent>
    </Card>
  );
};
