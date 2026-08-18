"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateTenantClosureRequest,
  CreateTenantClosureResponse,
  TenantClosureListResponse,
} from "@pawlog/shared";

import { Delete, Get, Post } from "@/shared/libs/axios/request";

const QUERY_KEY = ["tenant-closures"];

/** 임시 휴무일 목록 (오늘 이후). */
export const useTenantClosures = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await Get<TenantClosureListResponse, undefined>(
        "/v1/tenants/settings/closures",
      );
      return res.data.data?.closures ?? [];
    },
  });

/**
 * 휴무일 등록.
 *
 * ⚠️ 토스트가 세 갈래인 이유는 **안내가 닿지 않은 사람이 남을 수 있어서**다 (job-060).
 * 서버가 그 날 등원 예정이던 보호자에게 알림톡을 보내지만, 연락처가 없거나 발송이 실패한
 * 건은 조용히 빠진다. 그 차이를 말해주지 않으면 원장은 전원에게 통보된 줄 알고, 남은
 * 보호자는 문 닫은 매장 앞에 아이를 데리고 선다.
 *
 * 그래서 `affectedPets`(대상)와 `notifiedGuardians`(실제 발송)를 각각 받아 **그 차이**를
 * 문장으로 만든다. 차이가 있는 갈래만 경고색이다 — 그때만 원장이 할 일이 남는다.
 * (`releasedReservations` 는 삭제된 예약 행 수라 대상 수와 다르다. 요일 패턴으로 오는
 * 정기 등원 아이는 날짜 행이 없어 삭제 대상이 아니지만 통보 대상이다.)
 */
export const useCreateClosure = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTenantClosureRequest) => {
      const res = await Post<
        CreateTenantClosureResponse,
        CreateTenantClosureRequest
      >("/v1/tenants/settings/closures", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const affected = data?.affectedPets ?? 0;
      const notified = data?.notifiedGuardians ?? 0;
      const unreached = Math.max(0, affected - notified);

      if (affected === 0) {
        toast.success("휴무일로 지정했습니다. 이 날 등원 예정인 아이는 없어요.");
        return;
      }

      if (unreached === 0) {
        toast.success(
          `휴무일로 지정했습니다. 등원 예정이던 ${notified}명의 보호자에게 안내를 보냈어요.`,
          { duration: 8000 },
        );
        return;
      }

      // 안내가 닿지 않은 사람이 남았다 — 이게 원장이 **지금 해야 할 일**이라 경고색이다.
      toast.warning(
        notified > 0
          ? `휴무일로 지정했습니다. ${notified}명에게 안내를 보냈지만, ${unreached}명은 연락이 닿지 않아 직접 안내해주세요.`
          : `휴무일로 지정했습니다. 등원 예정이던 ${unreached}명에게 안내를 보내지 못했어요(연락처 없음 또는 발송 실패). 직접 안내해주세요.`,
        { duration: 8000 },
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "등록에 실패했습니다.");
    },
  });
};

export const useDeleteClosure = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      const res = await Delete<{ canceled: string }>(
        `/v1/tenants/settings/closures/${date}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // 취소됐던 예약은 되살아나지 않는다 — 보호자가 그 사이 다른 날로 옮겼을 수 있어,
      // 되살리면 본인이 모르는 예약이 하나 더 생긴다.
      toast.success(
        "휴무일을 해제했습니다. 취소된 예약은 자동으로 복구되지 않습니다.",
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "해제에 실패했습니다.");
    },
  });
};
