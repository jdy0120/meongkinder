"use client";

import { LogOut } from "lucide-react";
import { Button, Spinner } from "@pawlog/ui";

import { useCheckOut } from "../model/useCheckOut";

/**
 * 하원 체크 (feature ui).
 *
 * 등원 버튼과 같은 자리(원생 카드 우측의 64×64 버튼)에 그린다 — 아이 상태에 따라 버튼만
 * 바뀌고 **위치는 고정**이어야 20마리를 훑으며 같은 곳을 누를 수 있다.
 */
export const CheckOutButton = ({
  attendanceId,
  petName,
  fill = false,
}: {
  attendanceId: string;
  petName: string;
  /** 원생 카드 우측의 64×64 버튼으로 그린다. 표 안에서는 일반 버튼이어야 행이 깨지지 않는다. */
  fill?: boolean;
}) => {
  const checkOut = useCheckOut();

  return (
    <Button
      variant={fill ? "ghost" : "outline"}
      onClick={() => checkOut.mutate({ id: attendanceId, petName })}
      disabled={checkOut.isPending}
      aria-label={`${petName} 하원 처리`}
      /*
       * 하원은 등원보다 한 단계 약한 행동이라 채우지 않고 글자색만 primary 로 준다
       * (비-fill 이 `outline` 인 것과 같은 위계). 대신 **테두리는 있어야 한다** —
       * 카드 높이를 채우던 시절에는 왼쪽 구분선이 "여기부터 버튼"을 말해 줬지만,
       * 64×64 로 줄인 뒤로는 테두리가 없으면 그냥 떠 있는 글자로 읽힌다.
       * `ghost` 기본 글자색은 `--text`
       * (거의 검정)라 카드 본문과 구분되지 않아 누를 수 있는 것으로 안 읽힌다.
       * hover 도 함께 덮는다 — `ghost` 의 `hover:text-foreground` 가 다시 검정으로
       * 되돌려 놓기 때문이다.
       */
      className={
        fill
          ? "size-touch shrink-0 flex-col gap-1 rounded-btn border border-border px-0 text-label text-primary hover:bg-primary-tint hover:text-primary-on-tint"
          : undefined
      }
    >
      {checkOut.isPending ? <Spinner className='size-5' /> : <LogOut />}
      하원
    </Button>
  );
};
