"use client";

import { useState } from "react";
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
  fill = false,
}: CheckInButtonProps) => {
  const checkIn = useCheckIn();
  const [confirming, setConfirming] = useState(false);

  const hasExpired = expiredVaccinationTypes.length > 0;

  const run = () => {
    setConfirming(false);
    checkIn.mutate({ id: attendanceId, petName });
  };

  return (
    <>
      {/* ⚠️ `fill` 이어도 variant 는 `default`(bg-primary + 흰 글씨)를 유지한다.
          `ghost` 로 두면 글자색이 `--text`(#24211e, 거의 검정)로 떨어져 ① 카드 본문
          텍스트와 같은 색이라 **누를 수 있는 것으로 안 읽히고** ② 옆 칸의 하원 버튼과
          색이 같아 20장을 훑을 때 두 상태가 구분되지 않는다. 색이 곧 상태다. */}
      <Button
        onClick={() => (hasExpired ? setConfirming(true) : run())}
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
    </>
  );
};
