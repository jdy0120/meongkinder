import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  /** 확인하러 온 값. 크게 보여준다 (design-system.md §3). */
  value: ReactNode;
  unit?: string;
  /**
   * 색은 **긴급도만** 인코딩한다 (design-system.md §3.1).
   *   `caution`  오늘 신경 써야 함 (잔여 2회 이하, 미결제)
   *   `critical` 지금 조치 필요 (미도착, 접종 만료)
   */
  tone?: "default" | "caution" | "critical";
  action?: ReactNode;
}

const TONE_CLASS = {
  default: "",
  caution: "text-caution-text",
  critical: "text-danger",
} as const;

/**
 * 숫자 타일 (design-system.md §3).
 *
 * 잔여 횟수·오늘 등원 수처럼 **사용자가 그것을 보러 화면에 들어온** 값 전용이다.
 * 본문 크기로 적으면 스캔이 안 된다.
 */
export const StatTile = ({
  label,
  value,
  unit,
  tone = "default",
  action,
}: StatTileProps) => (
  <div className='flex items-center justify-between gap-3 rounded-card border bg-surface p-5 shadow-card'>
    <div className='min-w-0 space-y-1.5'>
      <p className='text-label text-muted-foreground'>{label}</p>
      <p className={`text-display ${TONE_CLASS[tone]}`}>
        {value}
        {unit && (
          <span className='ml-1 text-label font-semibold text-muted-foreground'>
            {unit}
          </span>
        )}
      </p>
    </div>
    {action && <div className='shrink-0'>{action}</div>}
  </div>
);
