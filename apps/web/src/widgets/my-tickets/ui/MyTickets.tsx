"use client";

import { CalendarCheck, Ticket } from "lucide-react";
import { Badge, Card, CardContent, Spinner } from "@pawlog/ui";

import { useMyPetTickets } from "@/entities/subscription";
import {
  AttendanceStatusBadge,
  useMyAttendances,
} from "@/entities/attendance";

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

/**
 * 보호자 - 아이별 이용권 잔액 + 등원 이력 (widget, job-046).
 *
 * ## 왜 아이별인가
 *
 * 잔액이 아이 단위로 쌓인다(job-045). 형제견을 맡긴 보호자는 "초코 10회권"과 "두부 5회권"을
 * 따로 사므로, 합계 숫자 하나만 보여주면 어느 쪽이 곧 떨어지는지 알 수 없다.
 *
 * ## 왜 출석 이력을 같이 두는가
 *
 * 회수권은 "며칠 갔더니 몇 번 남았다"가 맞아떨어져야 신뢰가 생긴다. 잔액만 있으면 숫자가
 * 맞는지 확인할 방법이 없어 문의가 매장으로 간다. 두 개를 한 화면에 두면 보호자가 스스로
 * 검산할 수 있다.
 */
export const MyTickets = () => {
  const { data: tickets, isLoading } = useMyPetTickets();
  const { data: attendances } = useMyAttendances();

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner className='size-6' />
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card className='border-dashed'>
        <CardContent className='flex flex-col items-center gap-2 py-10 text-center'>
          <Ticket className='size-6 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>
            아직 등록된 이용권이 없어요. 다니는 유치원에 문의해주세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <section className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold text-muted-foreground'>
          아이별 잔여 횟수
        </h2>
        {tickets.map((ticket) => (
          <Card key={ticket.petId}>
            <CardContent className='flex items-center justify-between py-4'>
              <span className='font-medium'>{ticket.petName}</span>
              <span className='flex items-center gap-2'>
                <span className='text-lg font-semibold'>{ticket.balance}</span>
                <span className='text-sm text-muted-foreground'>회 남음</span>
                {/* 0회는 다음 등원부터 차감되지 않는다(job-045) — 미리 알려야 현장에서 당황하지 않는다. */}
                {ticket.balance <= 0 && (
                  <Badge variant='destructive'>충전 필요</Badge>
                )}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='flex items-center gap-1.5 text-sm font-semibold text-muted-foreground'>
          <CalendarCheck className='size-4' />
          등원 이력
        </h2>
        {(attendances ?? []).length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            아직 등원 기록이 없어요.
          </p>
        ) : (
          <div className='flex flex-col gap-1.5'>
            {attendances?.map((attendance) => (
              <div
                key={attendance.id}
                className='flex items-center justify-between rounded-xl border px-3 py-2 text-sm'
              >
                <span>
                  <span className='font-medium'>{attendance.pet.name}</span>
                  <span className='ml-2 text-muted-foreground'>
                    {formatDate(attendance.date)}
                  </span>
                </span>
                <AttendanceStatusBadge status={attendance.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
