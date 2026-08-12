"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";
import { tenantPath } from "@/shared/libs/tenant/routes";
import type { OnboardTenantRequest, OnboardTenantResponse } from "@pawlog/shared";

/**
 * 매장 개설 뮤테이션 (feature model).
 *
 * 성공하면 **로그인한 그대로** 새 매장으로 들어간다.
 *
 * 예전에는 여기서 `/auth/login` 으로 보냈다("발급된 계정으로 로그인해주세요"). 그건 온보딩이
 * 매장 관리자 계정을 **따로 발급하던 시절**의 흐름이고, 지금 서버는 계정을 만들지 않는다 —
 * 요청자가 보유한 개설권 1건을 소비해 매장을 만들고 **요청자 본인에게** TENANT_ADMIN
 * 멤버십을 붙일 뿐이다(`TenantService.onboard`). 그래서 세션이 멀쩡한데도 로그인 화면으로
 * 튕겼고, 결제까지 마친 직후에 나타나 "결제가 잘못됐나"로 읽혔다.
 *
 * 목적지는 `/launch` 가 아니라 방금 만든 매장이다 — 개설권은 1인 1매장이라 `/launch` 로
 * 보내도 어차피 이 매장으로 직행하고, 그 한 번의 경유가 "내가 만든 게 열렸다"는 확인을 늦춘다.
 * 매장 게이트가 SSR 로 mypage 를 다시 부르므로 방금 생긴 멤버십은 그 시점에 반영된다.
 */
export const useOnboardTenant = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: OnboardTenantRequest) => {
      const res = await Post<OnboardTenantResponse, OnboardTenantRequest>(
        "/v1/tenants/onboard",
        values,
      );
      return res.data;
    },
    onSuccess: (data) => {
      const tenant = data.data?.tenant;
      toast.success(`'${tenant?.name}' 매장이 개설되었습니다.`);

      if (!tenant?.subdomain) {
        // 응답이 예상과 다르면 착지점 라우팅에 맡긴다 (job-042).
        router.replace("/launch");
        return;
      }

      router.replace(tenantPath(tenant.subdomain));
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "테넌트 생성에 실패했습니다.";
      toast.error(msg);
    },
  });
};
