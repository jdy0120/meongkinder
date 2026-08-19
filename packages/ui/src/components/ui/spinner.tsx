import { cn } from "../../lib/utils";
import { Loader2Icon } from "lucide-react";

/**
 * 로딩 스피너.
 *
 * `role='status'` + 접근 이름을 항상 들고 다닌다 — 없으면 화면에는 도는 원이 보이는데
 * 스크린리더에는 아무 일도 일어나지 않은 것으로 읽힌다.
 *
 * 기본 이름이 한국어인 이유: 이 앱의 `<html lang='ko'>` 아래에서 "Loading" 은
 * 한국어 음성 엔진이 그대로 읽어버린다.
 *
 * ⚠️ **목록이 들어올 자리에는 스피너 대신 골격(`Skeleton`)을 쓴다.** 스피너는 높이가
 * 콘텐츠와 달라서 데이터가 도착하는 순간 화면이 튄다(CLS). 스피너가 맞는 자리는
 * 크기를 미리 알 수 없는 짧은 작업 — 버튼 안, 확인 시트 안이다.
 */
function Spinner({
  className,
  label = "불러오는 중",
  ...props
}: React.ComponentProps<"svg"> & { label?: string }) {
  return (
    <Loader2Icon
      role='status'
      aria-label={label}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
