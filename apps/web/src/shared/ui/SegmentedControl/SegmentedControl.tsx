"use client";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 뒤에 붙는 개수. `0` 도 표시한다 — "오늘 미도착 0"은 그 자체가 정보다. */
  count?: number;
  /**
   * 주의가 필요한 묶음이면 `caution`. 색은 **긴급도만** 인코딩한다(§3.1)
   * — 분류마다 색을 주면 사용자는 색을 안 읽고 글자만 읽는다.
   */
  tone?: "default" | "caution";
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 스크린리더용 그룹 이름 (예: "원생 목록 필터"). */
  label: string;
}

/**
 * 가로 스크롤 필터 칩 (design-system.md §6.1).
 *
 * 칩 자체는 48px 이지만 **누를 수 있는 영역은 64px** 이다 — 젖은 손 기준 터치 타겟은
 * 64px 인데(§2.3), 칩을 통째로 64px 로 키우면 한 줄이 너무 두꺼워져 그 아래 카드가
 * 첫 화면에서 밀려난다. 그래서 시각 크기와 히트 영역을 분리한다.
 *
 * ⚠️ 스와이프로 탭을 넘기지 않는다(§3.2 MUST NOT). 젖은 손가락은 드래그 궤적이 튄다.
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) => (
  <div
    role='tablist'
    aria-label={label}
    // 스크롤바를 숨기지 않는다 — 오른쪽에 더 있다는 유일한 단서다.
    className='-mx-4 flex items-center gap-1.5 overflow-x-auto px-4'
  >
    {options.map((option) => {
      const selected = option.value === value;

      return (
        <button
          key={option.value}
          type='button'
          role='tab'
          aria-selected={selected}
          onClick={() => onChange(option.value)}
          // ⚠️ **히트 영역과 보이는 칩을 분리한다.** 바깥 버튼이 `h-touch`(44px)라
          // 손가락이 닿는 면적은 그대로고, 안쪽 칩만 36px 로 줄여 밀도를 얻는다.
          // 칩 자체를 44px 로 두면 필터 줄이 화면 높이를 크게 먹는다.
          className='flex h-touch shrink-0 items-center'
        >
          <span
            className={`flex h-control items-center gap-1.5 rounded-pill border px-3 text-label font-medium transition-colors duration-150 ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : option.tone === "caution"
                  ? "border-transparent bg-caution-tint text-caution-text"
                  : "border-border bg-surface text-muted-foreground"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={selected ? "opacity-90" : "opacity-70"}
                aria-hidden
              >
                {option.count}
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);
