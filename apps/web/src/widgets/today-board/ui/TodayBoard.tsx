"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Bus, Clock, Ticket, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@pawlog/ui";
import { BADGE_LEVEL, type DashboardResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import { SectionHeading } from "@/shared/ui";
import { LevelBadge } from "@/entities/pet";

/**
 * 매장 대시보드 본문 (design-system.md §6.2).
 *
 * ## 순서가 이 위젯의 전부다
 *
 * 우선순위 기준은 '중요도'가 아니라 **"지금 안 보면 되돌릴 수 없는 정도 × 오전에만 대응
 * 가능한 정도"** 다. 그래서 아래 다섯 블록의 순서를 바꾸지 않는다 —
 *
 *   1 오늘 등원 현황   미도착 → 즉시 보호자 확인 전화
 *   2 오늘 주의할 아이  사고 예방 정보라 사후 확인이 무의미하다
 *   3 훈련사 배치 비율  결원 시 **오전에만** 대체 인력을 구할 수 있다
 *   4 픽업 타임라인    오후 혼잡을 오전에 알아야 배치를 조정한다
 *   5 이용권 잔여      하원 때 보호자를 만나며 말하면 된다 (가장 덜 급하다)
 *
 * 한 화면에 동시에 노출되는 정보 블록은 최대 5개라는 제약(§1)과 정확히 맞는다.
 *
 * ## 한 번에 받아 오는 이유
 *
 * 블록마다 따로 부르면 우선순위가 **로딩 순서**로 바뀐다(늦게 온 것이 늦게 뜬다).
 * 순서를 정해 놓고 순서를 네트워크에 맡기면 정한 의미가 없다.
 */
export const TodayBoard = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const tenantId = useTenantStore((state) => state.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", tenantId],
    queryFn: async () => {
      const res = await Get<DashboardResponse, undefined>(
        "/v1/admin/dashboard",
      );
      return res.data.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className='flex justify-center py-16'>
        <Spinner className='size-8 text-primary' />
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      <AttendanceBlock data={data.attendance} tenant={tenant} />
      <AttentionBlock data={data.attention} />
      <StaffingBlock data={data.staffing} />
      <PickupBlock data={data.pickup} />
      <PassesBlock data={data.passes} tenant={tenant} />
    </div>
  );
};

/**
 * 1순위 — 오늘 등원 현황.
 *
 * 큰 숫자는 `14 / 18마리` 지만, 실무 정보는 그 아래 두 줄이다: **미도착 이름**과
 * **지금 올 차례**. 등원 시각이 흩어져 있어 "몇 마리 왔나"만으로는 아무것도 할 수 없다.
 */
const AttendanceBlock = ({
  data,
  tenant,
}: {
  data: DashboardResponse["attendance"];
  tenant: string;
}) => (
  <section className='space-y-3'>
    <SectionHeading
      action={
        <Link
          href={tenantPath(tenant, "attendance")}
          className='flex h-touch items-center px-2 text-label text-primary'
        >
          출석부
        </Link>
      }
    >
      오늘 등원
    </SectionHeading>

    <div className='space-y-4 rounded-card border bg-surface p-4'>
      <p className='text-display'>
        {data.checkedIn}
        <span className='text-title text-muted-foreground'>
          {" / "}
          {data.total}마리
        </span>
      </p>

      {/* 미도착이 **먼저**다. 이 화면에서 유일하게 "지금 전화해야 하는" 항목이다. */}
      {data.absent.length > 0 && (
        <div className='space-y-2 rounded-xl bg-caution-tint p-4'>
          <p className='flex items-center gap-2 text-body font-semibold text-caution-text'>
            <AlertTriangle className='size-5' />
            미도착 {data.absent.length}마리
          </p>
          <p className='break-keep text-body text-caution-text'>
            {data.absent.map((pet) => pet.name).join(", ")}
          </p>
        </div>
      )}

      {data.scheduled.length > 0 ? (
        <div className='space-y-2'>
          <p className='text-label text-muted-foreground'>
            아직 안 온 아이 {data.scheduled.length}마리
          </p>
          <ul className='space-y-1.5'>
            {data.scheduled.map((pet) => (
              <li key={pet.id} className='flex justify-between gap-3 text-body'>
                <span className='truncate'>{pet.name}</span>
                <span className='shrink-0 text-muted-foreground'>
                  {pet.pickupTime ?? "시각 미정"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className='text-body text-muted-foreground'>
          오늘 올 아이는 모두 등원했어요.
        </p>
      )}
    </div>
  </section>
);

/**
 * 2순위 — 오늘 주의할 아이.
 *
 * 1순위에서 등원 여부를 확인한 **직후**에 봐야 조회 맥락이 이어진다. 오늘 오는 아이만
 * 나오므로, 전체 원생 목록을 따로 뒤질 필요가 없다.
 */
const AttentionBlock = ({
  data,
}: {
  data: DashboardResponse["attention"];
}) => (
  <section className='space-y-3'>
    <SectionHeading>오늘 주의할 아이</SectionHeading>

    {data.length === 0 ? (
      <p className='rounded-card border bg-surface p-4 text-body text-muted-foreground'>
        오늘 오는 아이 중 특별히 신경 쓸 아이는 없어요.
      </p>
    ) : (
      <ul className='space-y-3'>
        {data.map((pet) => (
          <li
            key={pet.id}
            className={`space-y-3 rounded-card border border-border bg-surface p-4 ${
              pet.level === BADGE_LEVEL.CRITICAL
                ? "border-2 border-danger"
                : "border border-border"
            }`}
          >
            <p className='text-name'>{pet.name}</p>
            <div className='flex flex-wrap gap-2'>
              {pet.reasons.map((reason) => (
                <LevelBadge key={reason.label} level={reason.level}>
                  {reason.label}
                </LevelBadge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/**
 * 3순위 — 훈련사 배치 비율.
 *
 * `1 : 6` 로 보여준다. 단순 출근 인원("3명")은 많은 건지 적은 건지 알 수 없어 판단
 * 기준이 되지 못한다. 결원은 **오전에만** 대체 인력을 구할 수 있어서 이 자리에 있다.
 */
const StaffingBlock = ({ data }: { data: DashboardResponse["staffing"] }) => (
  <section className='space-y-3'>
    <SectionHeading>훈련사 배치</SectionHeading>

    <div className='flex items-center justify-between gap-3 rounded-card border bg-surface p-4'>
      <div className='space-y-1.5'>
        <p className='text-label text-muted-foreground'>훈련사 1명당</p>
        <p className='text-display'>
          {data.petsPerStaff === null ? "—" : `1 : ${data.petsPerStaff}`}
        </p>
      </div>
      <p className='flex items-center gap-2 text-body text-muted-foreground'>
        <Users className='size-5' />
        {data.staffCount}명 · {data.petCount}마리
      </p>
    </div>
  </section>
);

/**
 * 4순위 — 하원·픽업 타임라인.
 *
 * 시간대별 막대. 오후 혼잡 구간(대개 15~18시)을 **오전에** 인지시켜 배치를 조정하게 하는
 * 것이 목적이라, 누가 몇 시인지는 여기서 답하지 않는다(원생 목록이 답한다).
 */
const PickupBlock = ({ data }: { data: DashboardResponse["pickup"] }) => {
  const max = Math.max(1, ...data.hours.map((bucket) => bucket.count));

  return (
    <section className='space-y-3'>
      <SectionHeading>하원·픽업</SectionHeading>

      <div className='space-y-4 rounded-card border bg-surface p-4'>
        {data.hours.length === 0 ? (
          <p className='text-body text-muted-foreground'>
            픽업 시각이 입력된 아이가 없어요. 원생 정보에서 넣으면 여기 시간대별로 모입니다.
          </p>
        ) : (
          <ul className='space-y-2'>
            {data.hours.map((bucket) => (
              <li key={bucket.hour} className='flex items-center gap-3'>
                <span className='w-12 shrink-0 text-label text-muted-foreground'>
                  {bucket.hour}
                </span>
                {/* 막대는 채움 전용 색(caution)을 쓴다 — 텍스트를 올리지 않으므로
                    대비 제약이 없고, 숫자는 막대 밖에 둔다 (§2.1 MUST NOT). */}
                <span
                  className='h-6 rounded-pill bg-caution'
                  style={{ width: `${(bucket.count / max) * 100}%` }}
                  aria-hidden
                />
                <span className='shrink-0 text-body'>{bucket.count}</span>
              </li>
            ))}
          </ul>
        )}

        {data.shuttles.length > 0 && (
          <div className='flex flex-wrap gap-2 border-t pt-4'>
            {data.shuttles.map((shuttle) => (
              <span
                key={shuttle.number}
                className='flex items-center gap-2 rounded-pill bg-muted px-3 py-1.5 text-label'
              >
                <Bus className='size-4' />
                {shuttle.number}호차 {shuttle.count}마리
              </span>
            ))}
          </div>
        )}

        {data.unsetCount > 0 && (
          <p className='flex items-center gap-2 text-label text-muted-foreground'>
            <Clock className='size-4' />
            픽업 시각 미입력 {data.unsetCount}마리 — 이 아이들은 위 집계에 없습니다.
          </p>
        )}
      </div>
    </section>
  );
};

/**
 * 5순위 — 이용권 잔여.
 *
 * 하원 때 보호자를 만나는 타이밍에 재결제 대화를 걸 수 있게 이름을 보여준다.
 * 시간 민감도가 가장 낮아 맨 아래다.
 *
 * ⚠️ 스펙의 "미결제 건수"는 없다 — 이 스키마의 매출은 돈을 받은 시점에만 생기고
 * 외상/미수금 개념이 없다. 0으로 그리면 "미결제가 없다"고 읽히는데 그건 거짓이다.
 */
const PassesBlock = ({
  data,
  tenant,
}: {
  data: DashboardResponse["passes"];
  tenant: string;
}) => (
  <section className='space-y-3'>
    <SectionHeading
      action={
        <Link
          href={tenantPath(tenant, "subscriptions")}
          className='flex h-touch items-center px-2 text-label text-primary'
        >
          이용권
        </Link>
      }
    >
      잔여 이용권
    </SectionHeading>

    {data.lowBalance.length === 0 ? (
      <p className='rounded-card border bg-surface p-4 text-body text-muted-foreground'>
        곧 소진되는 이용권이 없어요.
      </p>
    ) : (
      <ul className='space-y-2 rounded-card border bg-surface p-4'>
        {data.lowBalance.map((pet) => (
          <li
            key={pet.petId}
            className='flex items-center justify-between gap-3'
          >
            <span className='flex items-center gap-2 truncate text-body'>
              <Ticket className='size-4 text-muted-foreground' />
              {pet.name}
            </span>
            <LevelBadge
              level={
                pet.balance <= 0 ? BADGE_LEVEL.CRITICAL : BADGE_LEVEL.CAUTION
              }
            >
              잔여 {pet.balance}회
            </LevelBadge>
          </li>
        ))}
      </ul>
    )}

    {/* job-063: 이용권 없이 받은 등원.
        잔액 0이어도 등원을 막지 않기로 했으므로(현관에서 막으면 앱 밖에서 처리돼 기록
        자체가 사라진다) 그렇게 지나간 날이 여기에는 보여야 한다. 없으면 아예 그리지
        않는다 — "0건"을 늘 띄우면 카드만 하나 늘고 읽히지 않는다. */}
    {data.unpaid.length > 0 && (
      <ul className='mt-3 space-y-2 rounded-card border-2 border-danger bg-surface p-4'>
        <li className='text-body font-semibold text-danger'>
          이용권 없이 받은 등원
        </li>
        {data.unpaid.map((pet) => (
          <li
            key={pet.petId}
            className='flex items-center justify-between gap-3'
          >
            <span className='flex items-center gap-2 truncate text-body'>
              <Ticket className='size-4 text-muted-foreground' />
              {pet.name}
            </span>
            <LevelBadge level={BADGE_LEVEL.CRITICAL}>
              미차감 {pet.count}회
            </LevelBadge>
          </li>
        ))}
      </ul>
    )}
  </section>
);
