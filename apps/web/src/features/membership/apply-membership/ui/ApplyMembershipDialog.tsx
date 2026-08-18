"use client";

import { useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Spinner,
} from "@pawlog/ui";

import {
  BUSINESS_STATUS,
  BUSINESS_STATUS_LABEL,
  formatTodayHours,
  resolveBusinessStatus,
} from "@pawlog/shared";

import { KakaoMap, type MapBounds } from "@/shared/ui";
import {
  useApplyMembership,
  useTenantDirectory,
} from "../model/useApplyMembership";

/**
 * 매장 검색 + 가입 신청 다이얼로그 (feature ui).
 * 신청 후에는 관리자가 승인해야 이용할 수 있다는 점을 분명히 안내한다.
 */
export const ApplyMembershipDialog = () => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [bounds, setBounds] = useState<MapBounds | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: tenants, isFetching } = useTenantDirectory(search, bounds);
  const apply = useApplyMembership(() => {
    setOpen(false);
    setKeyword("");
    setSearch("");
    setSelectedId(null);
  });

  // 좌표가 있는 매장만 핀이 된다. 없는 매장은 아래 목록에만 나온다.
  const pinned = useMemo(
    () =>
      (tenants ?? [])
        .filter(
          (tenant): tenant is typeof tenant & {
            latitude: number;
            longitude: number;
          } => tenant.latitude !== null && tenant.longitude !== null,
        )
        .map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
        })),
    [tenants],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className='gap-1.5'>
          <Store className='h-4 w-4' />
          매장 찾기
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>매장 가입 신청</DialogTitle>
          <DialogDescription>
            아이를 맡길 매장을 찾아 신청하세요. 매장 관리자가 승인하면 이용할 수
            있습니다.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(keyword);
          }}
          className='flex gap-2'
        >
          <Input
            placeholder='매장 이름으로 검색'
            value={keyword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setKeyword(e.target.value)
            }
          />
          <Button type='submit' variant='secondary' className='gap-1.5'>
            <Search className='h-4 w-4' />
            검색
          </Button>
        </form>

        {/*
          지도는 목록의 **대체가 아니라 보조**다. 주소를 아직 등록하지 않은 매장은 좌표가
          없어 핀이 찍히지 않는데, 그 매장이 화면에서 통째로 사라지면 안 된다.
          그래서 지도와 목록을 함께 둔다.
        */}
        <KakaoMap
          markers={pinned}
          onBoundsChange={setBounds}
          onSelect={setSelectedId}
          className='h-56 w-full rounded-xl border'
        />

        <div className='max-h-64 space-y-2 overflow-y-auto'>
          {isFetching && (
            <div className='flex justify-center py-6'>
              <Spinner className='h-6 w-6' />
            </div>
          )}

          {!isFetching && (search || bounds) && tenants?.length === 0 && (
            <p className='py-6 text-center text-sm text-muted-foreground'>
              이 지역에는 등록된 매장이 없습니다. 이름으로 검색해보세요.
            </p>
          )}

          {tenants?.map((tenant) => (
            <div
              key={tenant.id}
              className={`flex items-center justify-between rounded-xl border p-3 ${
                tenant.id === selectedId ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className='min-w-0'>
                <p className='truncate font-medium'>{tenant.name}</p>
                <p className='truncate text-xs text-muted-foreground'>
                  {/* 주소가 있으면 주소를 보여준다 — 보호자에게 서브도메인은 의미가 없다. */}
                  {tenant.roadAddress ?? tenant.subdomain}
                </p>
                {/*
                 * 오늘 영업 여부 (job-060). 운영시간을 등록하지 않은 매장은 **아무것도
                 * 쓰지 않는다** — "운영시간 미등록"을 매장마다 반복해 적으면 목록이
                 * 그 문구로 뒤덮이고, 정작 시간을 넣은 매장이 눈에 안 띈다.
                 */}
                {tenant.businessHours && (
                  <p className='truncate text-xs'>
                    <span
                      className={
                        resolveBusinessStatus(tenant.businessHours) ===
                        BUSINESS_STATUS.OPEN
                          ? "font-semibold text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {
                        BUSINESS_STATUS_LABEL[
                          resolveBusinessStatus(tenant.businessHours)
                        ]
                      }
                    </span>
                    {formatTodayHours(tenant.businessHours) && (
                      <span className='text-muted-foreground'>
                        {" · "}
                        {formatTodayHours(tenant.businessHours)}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <Button
                disabled={apply.isPending}
                onClick={() => apply.mutate(tenant.id)}
              >
                신청
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
