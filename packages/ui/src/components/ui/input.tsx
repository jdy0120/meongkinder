import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * 입력 높이 스케일 — **Button 과 같은 눈금을 쓴다** (job-057).
 *
 * 이 스케일이 Button 의 것과 어긋나면 화면에서 바로 드러난다: 검색창처럼 입력과 버튼을
 * 나란히 두는 자리가 이 저장소에만 10곳이 넘고, 거기서 둘의 높이 차이가 그대로 보인다.
 * job-052 가 Button 을 44→64px 로 올릴 때 Input 은 shadcn 기본값 `h-8`(32px)에 남아
 * **32px 이 어긋난 채**였다 — `DogRoster` 만 `className='h-touch'` 로 덧칠해 맞춰 뒀고
 * 나머지는 전부 틀어져 있었다.
 *
 * 그래서 화면마다 덧칠하지 않고 **정의를 고친다**(job-050·job-052 와 같은 판단):
 *
 *   default 64px — 기본. `h-touch` 로 Button 기본값과 같은 토큰을 참조한다
 *   sm      48px — 데스크톱 콘솔의 조밀한 표 안 (Button `sm` 과 짝)
 *   xs      40px — @pawlog/ui 내부 조립용 (Button `xs` 와 짝). 화면 코드 금지
 *
 * 높이만 맞추면 안 된다 — 글자 크기도 Button 과 같은 눈금(`text-body`/`text-label`)을
 * 쓴다. 예전 `text-base ... md:text-sm` 는 뷰포트에 따라 입력만 글자가 줄어, 옆 버튼과
 * 높이는 같은데 글자만 달라 보이는 상태였다.
 */
const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-input bg-transparent transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-label file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      inputSize: {
        default: "h-touch px-4 py-1 text-body",
        sm: "h-12 px-3 py-1 text-label",
        xs: "h-10 px-2.5 py-1 text-label",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  },
);

/**
 * `size` 가 아니라 `inputSize` 인 이유: 네이티브 `<input>` 에는 이미 `size`(표시 문자 수,
 * number) 속성이 있다. 같은 이름을 쓰면 `size='sm'` 이 DOM 으로 새어 나가 React 가
 * 경고를 내거나, 반대로 문자 수를 넘기려던 코드가 조용히 무시된다.
 */
type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants>;

function Input({ className, type, inputSize, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
