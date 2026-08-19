"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";
import { formatPhone } from "@pawlog/shared";
import type { NotificationLog } from "@pawlog/database";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { ListSkeleton } from "@/shared/ui";

const TYPE_LABEL: Record<string, string> = {
  CHECK_IN: "등원",
  CHECK_OUT_REPORT: "하원 + 알림장",
  REMAINING_COUNT_LOW: "잔여횟수 임박",
  RESERVATION_REMINDER: "등원 예정",
  FEED_POST: "사진 피드",
};

const formatWhen = (value: string | Date) =>
  new Date(value).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * 알림 발송 이력 (widget, job-046).
 *
 * ## 왜 필요한가
 *
 * 알림톡은 실패해도 조용하다 — 발송 실패는 `NotificationLog.status = FAILED` 로만 남고,
 * 그걸 볼 화면이 아예 없었다. 원장은 "보냈는데 안 왔다"는 보호자 문의를 받고서야 알게 되고,
 * 확인할 방법도 없었다. 알림톡이 이 제품의 전달 경로 전체이므로(보호자 상당수가 앱을 쓰지
 * 않는다) 여기가 막히면 서비스가 통째로 멈춘 것과 같다.
 *
 * 실패 건을 맨 위에 요약해 눈에 띄게 한다 — 목록에 섞어두면 스크롤하다 놓친다.
 */
export const NotificationLogTable = () => {
  // 페이지 상태는 위젯이 갖는다 (usePaginatedList 는 query 를 받기만 한다).
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaginatedList<NotificationLog>(
    "notification-logs",
    "/v1/notifications",
    { page, pageSize: 30 },
  );

  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <ListSkeleton variant='row' count={6} label='알림 발송 이력 불러오는 중' />
      </div>
    );
  }

  const logs = data?.items ?? [];
  const failed = logs.filter((log) => log.status === "FAILED");

  return (
    <div className='flex flex-col gap-4'>
      {failed.length > 0 && (
        <Card className='border-destructive/30 bg-destructive/5'>
          <CardContent className='flex items-start gap-2 py-3 text-sm'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0 text-destructive' />
            <p>
              최근 <span className='font-semibold'>{failed.length}건</span>의
              알림이 발송되지 못했습니다. 번호가 맞는지 확인하고, 필요하면
              보호자에게 직접 연락해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {logs.length === 0 ? (
        <p className='py-12 text-center text-sm text-muted-foreground'>
          아직 발송된 알림이 없어요.
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>보낸 때</TableHead>
                <TableHead>종류</TableHead>
                <TableHead>받는 번호</TableHead>
                <TableHead>수단</TableHead>
                <TableHead>결과</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className='whitespace-nowrap text-muted-foreground'>
                    {formatWhen(log.createdAt)}
                  </TableCell>
                  <TableCell>{TYPE_LABEL[log.type] ?? log.type}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatPhone(log.recipientPhone)}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {log.channel === "ALIMTALK" ? "알림톡" : "문자"}
                  </TableCell>
                  <TableCell>
                    {log.status === "SUCCESS" ? (
                      <Badge variant='outline'>발송됨</Badge>
                    ) : (
                      <Badge variant='destructive' title={log.errorMessage ?? ""}>
                        실패
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(data?.meta.totalPages ?? 1) > 1 && (
        <div className='flex justify-center gap-2 text-sm'>
          <button
            type='button'
            disabled={!data?.meta.hasPrev}
            onClick={() => setPage(page - 1)}
            className='rounded-xl border px-3 py-1 disabled:opacity-40'
          >
            이전
          </button>
          <span className='px-2 py-1 text-muted-foreground'>
            {page} / {data?.meta.totalPages}
          </span>
          <button
            type='button'
            disabled={!data?.meta.hasNext}
            onClick={() => setPage(page + 1)}
            className='rounded-xl border px-3 py-1 disabled:opacity-40'
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};
