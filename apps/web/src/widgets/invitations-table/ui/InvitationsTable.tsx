"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";
import type { TenantInvitation } from "@pawlog/database";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import { RoleBadge } from "@/entities/user";
import { CreateInvitationDialog } from "@/features/invitation/create-invitation";
import { useCancelInvitation } from "@/features/invitation/cancel-invitation";
import { ListSkeleton } from "@/shared/ui";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  ACCEPTED: "수락됨",
  CANCELED: "취소됨",
  EXPIRED: "만료",
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 초대 목록 위젯.
 * 아직 가입하지 않은 사람을 연락처로 선등록해 둔 건들이 여기 쌓이고,
 * 그 사람이 가입하면 상태가 ACCEPTED 로 바뀐다.
 */
export const InvitationsTable = () => {
  const tenantId = useTenantStore((state) => state.tenantId);
  const cancelInvitation = useCancelInvitation();

  const { data, isLoading } = useQuery({
    queryKey: ["invitations", tenantId],
    queryFn: async () => {
      const res = await Get<{ invitations: TenantInvitation[] }, undefined>(
        "/v1/invitations",
      );
      return res.data.data?.invitations ?? [];
    },
    enabled: Boolean(tenantId),
  });

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div>
          <h2 className='text-base font-semibold'>초대</h2>
          <p className='text-xs text-muted-foreground'>
            아직 가입하지 않은 보호자도 연락처와 아이 정보로 미리 등록해 둘 수
            있습니다.
          </p>
        </div>
        <CreateInvitationDialog />
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <ListSkeleton variant='row' count={4} label='초대 목록 불러오는 중' />
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>연락처</TableHead>
                  <TableHead>아이</TableHead>
                  <TableHead>자격</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead className='text-right'>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.length > 0 ? (
                  data.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        {invitation.email ?? invitation.phone ?? "—"}
                      </TableCell>
                      <TableCell>{invitation.petName ?? "—"}</TableCell>
                      <TableCell>
                        <RoleBadge role={invitation.role} />
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {STATUS_LABELS[invitation.status] ?? invitation.status}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatDate(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {invitation.status === "PENDING" && (
                          <Button
                           
                            variant='outline'
                            disabled={cancelInvitation.isPending}
                            onClick={() => cancelInvitation.mutate(invitation.id)}
                            className='gap-1.5'
                          >
                            <X className='h-3.5 w-3.5' />
                            취소
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='py-12 text-center text-muted-foreground'
                    >
                      등록된 초대가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
