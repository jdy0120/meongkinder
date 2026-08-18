"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";

import { PhotoImage } from "@/entities/file";
import { useMe } from "@/entities/user";

/**
 * 헤더 우측의 내 프로필 사진 (widget) — job-063.
 *
 * ## 왜 위젯인가
 *
 * `PageShell` 은 `shared` 레이어라 `entities` 를 import 할 수 없다(FSD 단방향). 그래서
 * 껍데기는 `action` 슬롯만 열어 두고, 무엇을 넣을지는 view 가 정한다 — 하단 탭(`nav`)이
 * 이미 같은 이유로 그렇게 되어 있다.
 *
 * ## 로그인 여부를 스스로 본다
 *
 * `useMe` 는 401 을 에러가 아니라 "로그인 안 함"으로 돌려주므로(랜딩에서도 쓰인다),
 * 여기서 그대로 재사용하면 비로그인 화면에 실수로 끼워 넣어도 조용히 아무것도 그리지
 * 않는다. 사진 없는 계정은 닉네임 첫 글자로 대신한다 — 빈 원을 두면 "안 불러와진 것"과
 * "안 올린 것"이 같아 보인다.
 */
export const ProfileAvatar = () => {
  const { data: user } = useMe();

  if (!user) return null;

  const initial = user.nickname?.trim().charAt(0);

  return (
    <Link
      href='/profile'
      aria-label='내 정보'
      // 뒤로가기 화살표와 같은 64px 터치 타겟 (design-system.md §2.3). 헤더가 얇게
      // 유지되도록 사진 자체는 그보다 작게 두고 히트 영역만 키운다.
      className='-mr-3 flex size-touch shrink-0 items-center justify-center rounded-pill transition-colors hover:bg-accent'
    >
      {user.profileImageFileId ? (
        <PhotoImage
          fileId={user.profileImageFileId}
          alt='내 프로필 사진'
          className='size-10 rounded-pill object-cover'
        />
      ) : (
        <span className='flex size-10 items-center justify-center rounded-pill bg-muted text-body font-semibold text-muted-foreground'>
          {initial || <UserRound className='size-5' />}
        </span>
      )}
    </Link>
  );
};
