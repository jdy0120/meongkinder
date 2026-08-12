"use client";

import type { ReactNode } from "react";
import { Phone, X } from "lucide-react";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
} from "@pawlog/ui";
import { formatPhone } from "@pawlog/shared";

interface BottomSheetProps {
  /** 열기 트리거. 제어형으로 쓰려면 생략하고 `open`/`onOpenChange` 를 넘긴다. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title: ReactNode;
  description?: ReactNode;

  /**
   * 보호자 전화번호. 넘기면 **시트 최상단**에 전화 걸기 버튼이 생긴다
   * (design-system.md §3.2 MUST).
   *
   * 왜 최상단인가: 원장이 원생 상세를 여는 가장 잦은 목적이 "보호자에게 지금 전화"다
   * (미도착·구토·다툼). 그걸 스크롤 아래에 두면 급할 때 못 찾는다.
   * 숫자만 저장하고 하이픈으로 그리는 규칙(job-043)은 여기서도 같다.
   */
  guardianPhone?: string | null;

  /** 하단 고정 액션. 파괴적 동작은 §2.3 에 따라 24px 이상 떨어뜨린다. */
  footer?: ReactNode;

  children?: ReactNode;
}

/**
 * 바텀 시트 (design-system.md §3.2).
 *
 * **상세 조회는 페이지 이동이 아니라 시트로 띄운다.** 목록에서 20번째 아이를 확인하고
 * 뒤로 나오면 스크롤이 맨 위로 돌아가는데, 등하원 시간대에 그 목록을 위아래로 훑는 게
 * 실제 업무라 매번 처음부터 다시 찾게 된다.
 *
 * 상단 다이얼로그가 아니라 시트인 이유는 엄지 도달 범위다 — 한 손으로 폰을 쥔 채
 * 화면 위쪽 버튼은 누를 수 없다.
 */
export const BottomSheet = ({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  guardianPhone,
  footer,
  children,
}: BottomSheetProps) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}

    <DrawerContent className='rounded-t-2xl'>
      <div className='mx-auto flex w-full max-w-2xl flex-col overflow-hidden'>
        <div className='flex items-start gap-3 px-5 pt-4'>
          <div className='min-w-0 flex-1 space-y-1.5'>
            <DrawerTitle className='truncate text-title'>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className='break-keep text-label text-muted-foreground'>
                {description}
              </DrawerDescription>
            ) : (
              // Radix 는 Description 이 없으면 콘솔 경고를 낸다. 화면에는 안 보이게 둔다.
              <DrawerDescription className='sr-only'>
                상세 정보
              </DrawerDescription>
            )}
          </div>

          <DrawerClose asChild>
            <Button variant='ghost' size='icon' aria-label='닫기'>
              <X />
            </Button>
          </DrawerClose>
        </div>

        {guardianPhone && (
          <div className='px-5 pt-4'>
            <Button asChild size='lg' className='w-full'>
              <a href={`tel:${guardianPhone}`}>
                <Phone />
                보호자에게 전화 ({formatPhone(guardianPhone)})
              </a>
            </Button>
          </div>
        )}

        {/* `overflow-y-auto` 만 주면 CSS 규칙상 overflow-x 가 visible → **auto** 로
            승격돼, 안에 조금만 넓은 요소가 있어도 가로 스크롤바가 생긴다. 명시적으로 막는다. */}
        <div className='min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-5 py-6'>
          {children}
        </div>

        {footer && (
          <DrawerFooter className='gap-3 border-t px-5 py-4'>
            {footer}
          </DrawerFooter>
        )}
      </div>
    </DrawerContent>
  </Drawer>
);
