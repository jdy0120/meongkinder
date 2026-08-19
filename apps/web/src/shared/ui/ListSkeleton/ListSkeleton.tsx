import { Skeleton } from "@pawlog/ui";

type ListSkeletonVariant = "card" | "row" | "tile";

interface ListSkeletonProps {
  /**
   * 들어올 콘텐츠의 모양.
   *   - `card` 원생 카드·게시물처럼 아바타 + 두 줄 글
   *   - `row`  표의 한 줄
   *   - `tile` 사진 격자 한 칸
   */
  variant?: ListSkeletonVariant;
  /** 몇 개를 미리 그릴지. 첫 화면에 실제로 보이는 개수에 맞춘다. */
  count?: number;
  /** 접근성 이름. "원생 목록 불러오는 중" 처럼 무엇을 기다리는지 밝힌다. */
  label: string;
  className?: string;
}

/**
 * 목록 골격 (design-system.md §6 · ux: Loading Indicators).
 *
 * ## 스피너를 걷어낸 이유
 *
 * 목록 자리에 스피너 하나를 띄우면 그 블록의 높이가 **콘텐츠와 전혀 다르다**. 데이터가
 * 도착하는 순간 화면이 갑자기 늘어나면서 아래 있던 것들이 밀려 내려간다 — 마침 그때
 * 버튼을 누르려던 손가락은 다른 것을 누른다. 등하원 현관에서 한 손으로 쓰는 화면이라
 * 이 오작동이 실제로 일어난다.
 *
 * 골격은 들어올 내용과 **같은 높이를 미리 차지**하므로 도착해도 아무것도 움직이지 않는다.
 * 덤으로 "무엇이 들어올 자리인지"가 기다리는 동안 보인다.
 *
 * ## `aria-busy` 를 다는 이유
 *
 * 화면에는 회색 블록이 움직이고 있지만 보조기술에는 **아무 일도 일어나지 않은 것**으로
 * 읽힌다. `role='status'` 로 한 번 알리고, 영역 전체에 `aria-busy` 를 걸어 "이 안은
 * 아직 확정되지 않았다"를 남긴다. 개수는 읽어 주지 않는다 — 아직 진짜 개수가 아니라서
 * 나중에 다른 숫자로 바뀌면 그게 더 혼란스럽다.
 *
 * ⚠️ 스피너가 맞는 자리는 따로 있다. **크기를 미리 알 수 없는 짧은 작업** — 버튼 안,
 * 확인 시트 안. 거기서는 골격이 오히려 과하다.
 */
export const ListSkeleton = ({
  variant = "card",
  count = 4,
  label,
  className,
}: ListSkeletonProps) => (
  <div
    role='status'
    aria-busy='true'
    aria-label={label}
    className={
      variant === "tile"
        ? `grid grid-cols-3 gap-2 ${className ?? ""}`
        : `flex flex-col gap-3 ${className ?? ""}`
    }
  >
    {Array.from({ length: count }, (_, i) => {
      if (variant === "tile") {
        return <Skeleton key={i} className='aspect-square w-full rounded-xl' />;
      }
      if (variant === "row") {
        return <Skeleton key={i} className='h-12 w-full rounded-xl' />;
      }
      return (
        <div
          key={i}
          className='flex items-center gap-3 rounded-card border p-4'
        >
          <Skeleton className='size-avatar shrink-0 rounded-full' />
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-3 w-2/3' />
          </div>
        </div>
      );
    })}
  </div>
);
