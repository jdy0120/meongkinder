import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-btn border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      /**
       * 크기 스케일 (design-system.md §2.3 — 터치 타겟 64px).
       *
       * 이 제품의 사용 환경은 **손이 젖어 있거나 목줄을 잡은 채 한 손 조작**이다.
       * 젖은 손가락은 접촉 면적이 커지고 좌표가 튀므로 일반적인 44px 권장치로는
       * 정확히 눌리지 않는다. 그래서 기본값이 64px 이다 — 커 보이는 게 아니라
       * **이 환경에서 44px 는 그냥 안 눌린다.**
       *
       *   xs 40px      — @pawlog/ui 내부 조립용 (combobox 안의 clear 등). 화면 코드 금지
       *   sm 48px      — **데스크톱 관리 콘솔(apps/admin) 표 안 전용.** 마우스를 전제한다
       *   default 64px — **기본.** 손가락으로 누르는 모든 곳
       *   lg 64px      — 화면 하단 고정 주 행동(CTA). 높이는 같고 패딩·글자가 크다
       *
       * ⚠️ `apps/web` 화면 코드에서 `sm`/`xs` 를 쓰지 않는다. 위 세 줄 중 하나라도
       * 어기면 젖은 손 요구사항이 조용히 깨진다 — 화면은 멀쩡해 보이고 현장에서만 틀린다.
       *
       * 이전 값(job-050: sm 36 / default 44 / lg 52)에서 올린 것이다. 그때도 같은
       * 교훈이었다: **화면마다 className 으로 높이를 덧칠하면 또 갈라지므로 정의를 고친다.**
       */
      size: {
        default:
          "h-touch gap-2 px-5 text-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-5",
        xs: "h-10 gap-1 px-3 text-label in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-12 gap-1.5 px-4 text-label in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-touch gap-2 px-8 text-body font-semibold has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-touch [&_svg:not([class*='size-'])]:size-5",
        "icon-xs":
          "size-10 in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-4",
        "icon-sm":
          "size-12 in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-touch [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot='button'
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
