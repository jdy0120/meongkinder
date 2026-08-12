"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@pawlog/ui";
import type { AttendanceWithPet } from "@pawlog/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { AttendanceStatusBadge, formatTime } from "@/entities/attendance";
import { CheckInButton } from "@/features/attendance/check-in";
import { CheckOutButton } from "@/features/attendance/check-out";
import { UpdateStatusDialog } from "@/features/attendance/update-status";

/**
 * 오늘의 출석부 목록 위젯. 페이지네이션 상태와 목록 조회를 자체 소유하고,
 * 상태 뱃지(entity)·등원/하원/결석·보강 처리(feature)를 조합한다.
 */
export const AttendanceTable = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePaginatedList<AttendanceWithPet>(
    "attendance-today",
    "/v1/attendances/today",
    { page, pageSize: 10 },
  );

  return (
    <Card>
      <CardHeader className='pb-3'>
        <p className='text-sm text-muted-foreground'>
          오늘 스케줄에 포함된 원생들의 등원/하원/결석·보강 현황입니다.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex justify-center items-center py-12'>
            <Spinner className='size-8 text-primary' />
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-muted-foreground font-semibold'>
                    이름
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    상태
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    등원 시각
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    하원 시각
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold text-right'>
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((attendance) => (
                    <TableRow key={attendance.id}>
                      <TableCell className='font-medium'>
                        {attendance.pet.name}
                      </TableCell>
                      <TableCell>
                        <AttendanceStatusBadge status={attendance.status} />
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatTime(attendance.checkInAt)}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatTime(attendance.checkOutAt)}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2 flex-wrap'>
                          {attendance.status === "SCHEDULED" && (
                            <CheckInButton
                              attendanceId={attendance.id}
                              petName={attendance.pet.name}
                            />
                          )}
                          {attendance.status === "CHECKED_IN" && (
                            <CheckOutButton
                              attendanceId={attendance.id}
                              petName={attendance.pet.name}
                            />
                          )}
                          {(attendance.status === "SCHEDULED" ||
                            attendance.status === "CHECKED_IN") && (
                            <UpdateStatusDialog attendanceId={attendance.id} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='text-center text-muted-foreground py-12'
                    >
                      오늘 등원 예정인 원생이 없어요. 원생의 등원 요일을
                      설정하면 그날 출석부가 자동으로 만들어집니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <span className='text-sm text-muted-foreground'>
              총 {data.meta.total}건 중 {page} / {data.meta.totalPages} 페이지
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
               
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className='cursor-pointer'
              >
                이전
              </Button>
              <Button
                variant='outline'
               
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className='cursor-pointer'
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
