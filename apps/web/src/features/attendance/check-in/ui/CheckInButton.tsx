"use client";

import { useState, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { Button, Spinner } from "@pawlog/ui";

import { BottomSheet } from "@/shared/ui";
import { vaccinationLabel } from "@/entities/pet";
import { useCheckIn } from "../model/useCheckIn";

interface CheckInButtonProps {
  attendanceId: string;
  petName: string;
  /**
   * 만료된 접종 종류들. 비어 있지 않으면 확인 시트를 먼저 띄운다.
   *
   * ⚠️ **버튼을 disable 하지 않는다**(design-system.md §6.1). 원장이 사정을 알고 받는
   * 경우가 실제로 있고(오늘 접종하러 가는 길에 맡기는 등), 아예 막으면 앱 밖에서
   * 처리해 버려 **기록 자체가 사라진다.** 막는 것보다 알고 누르게 하는 편이 안전하다.
   */
  expiredVaccinationTypes?: string[];
  /**
   * 이용권 잔여 횟수. `0` 이하면 확인 시트를 먼저 띄운다 (job-063).
   *
   * ⚠️ **여기서도 막지 않는다.** 접종 만료와 같은 이유이고, 이 경우는 더 그렇다 —
   * 접종은 안전 문제라 거절할 명분이라도 있지만 잔액 0은 돈 문제다. 아이는 이미 현관에
   * 와 있고 "오늘 받고 오후에 충전하세요"는 정상적인 영업이다. 앱이 막으면 원장은 앱
   * 밖에서 아이를 받고, 그러면 출석·알림장·사진이 통째로 사라지며 **나중에 충전해도 그
   * 날을 소급 차감할 방법이 없다.** 미수가 없어지는 게 아니라 보이지 않는 곳으로 옮겨간다.
   *
   * `null`/`undefined` 는 "이용권을 판 적이 없음"이라 경고하지 않는다 — 0회(다 씀)와
   * 구분해야 원장이 충전이 필요한 아이와 아직 안 판 아이를 다르게 대할 수 있다.
   */
  passRemaining?: number | null;
  /**
   * 잔액 0 시트 안의 "이용권 판매" 자리.
   *
   * FSD 상 feature 끼리 import 할 수 없어(`SellTicketDialog` 도 feature) 슬롯으로 받는다.
   * 넣는 쪽은 widget 이다 — `PageShell` 이 `nav`/`action` 을 받는 것과 같은 이유다.
   */
  sellAction?: ReactNode;
  /**
   * 원생 카드 우측 슬롯에 들어가는 **64×64 정사각 버튼**으로 그린다(아이콘 + 글자 2줄).
   *
   * 표 안(오늘의 출석부)에서는 일반 버튼이어야 행 높이가 깨지지 않으므로 기본값은 false 다.
   * 두 형태를 `variant` prop 으로 나누지 않고 이 불리언 하나로 두는 이유는 **모양만
   * 다르고 동작이 같기** 때문이다 — 동작이 갈리기 시작하면 그때 컴포넌트를 나눈다.
   */
  fill?: boolean;
}

/**
 * 등원 체크 (feature ui).
 *
 * 원생 카드 우측의 64×64 버튼. **스와이프가 아니라 탭**이다(§3.2 MUST NOT) —
 * 젖은 손가락은 드래그 궤적이 튀어 인식률이 낮고, 실패하면 사용자는 뭘 잘못했는지 모른다.
 */
export const CheckInButton = ({
  attendanceId,
  petName,
  expiredVaccinationTypes = [],
  passRemaining,
  sellAction,
  fill = false,
}: CheckInButtonProps) => {
  const checkIn = useCheckIn();
  const [confirming, setConfirming] = useState(false);
  const [noBalance, setNoBalance] = useState(false);

  const hasExpired = expiredVaccinationTypes.length > 0;
  const hasNoBalance = passRemaining !== null && passRemaining !== undefined && passRemaining <= 0;

  const run = () => {
    setConfirming(false);
    setNoBalance(false);
    checkIn.mutate({ id: attendanceId, petName });
  };

  /**
   * 접종 만료가 먼저다. 둘 다 걸리면 시트를 두 번 띄우지 않고 **안전 쪽 하나만** 보여준다 —
   * 급한 현관에서 시트가 연달아 뜨면 두 번째는 읽지 않고 눌러 넘긴다. 잔액은 그 자리에서
   * 못 받아도 나중에 회수할 수 있지만 접종은 그렇지 않다.
   */
  const handleClick = () => {
    if (hasExpired) return setConfirming(true);
    if (hasNoBalance) return setNoBalance(true);
    run();
  };

  return (
    <>
      {/* ⚠️ `fill` 이어도 variant 는 `default`(bg-primary + 흰 글씨)를 유지한다.
          `ghost` 로 두면 글자색이 `--text`(#24211e, 거의 검정)로 떨어져 ① 카드 본문
          텍스트와 같은 색이라 **누를 수 있는 것으로 안 읽히고** ② 옆 칸의 하원 버튼과
          색이 같아 20장을 훑을 때 두 상태가 구분되지 않는다. 색이 곧 상태다. */}
      <Button
        onClick={handleClick}
        disabled={checkIn.isPending}
        aria-label={`${petName} 등원 처리`}
        className={
          fill
            ? "size-touch shrink-0 flex-col gap-1 rounded-btn px-0 text-label"
            : undefined
        }
      >
        {checkIn.isPending ? <Spinner className='size-5' /> : <LogIn />}
        등원
      </Button>

      <BottomSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={`${vaccinationLabel(expiredVaccinationTypes[0] ?? "")}이 만료됐어요`}
        description={
          expiredVaccinationTypes.length > 1
            ? `${petName} · 만료 ${expiredVaccinationTypes.map(vaccinationLabel).join(" · ")}`
            : petName
        }
        footer={
          <>
            <Button size='lg' className='w-full' onClick={run}>
              알고 등원 처리
            </Button>
            <Button
              variant='outline'
              size='lg'
              className='w-full'
              onClick={() => setConfirming(false)}
            >
              취소
            </Button>
          </>
        }
      >
        <p className='break-keep text-body'>
          그래도 등원 처리할까요? 처리하면 보호자에게 등원 알림이 나갑니다.
        </p>
      </BottomSheet>

      <BottomSheet
        open={noBalance}
        onOpenChange={setNoBalance}
        title='남은 이용권이 없어요'
        description={`${petName} · 이번 등원은 차감되지 않고 미차감으로 기록됩니다`}
        footer={
          <>
            {/* 판매를 **첫 번째**로 둔다. 잔액 0은 접종 만료와 달리 그 자리에서 해결할 수
                있는 문제라, 원장을 바로 그리로 보내는 것이 맞다. */}
            {sellAction}
            <Button
              variant={sellAction ? "outline" : "default"}
              size='lg'
              className='w-full'
              onClick={run}
            >
              알고 등원 처리
            </Button>
            <Button
              variant='outline'
              size='lg'
              className='w-full'
              onClick={() => setNoBalance(false)}
            >
              취소
            </Button>
          </>
        }
      />
    </>
  );
};
