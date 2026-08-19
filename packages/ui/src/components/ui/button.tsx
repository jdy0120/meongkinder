import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-btn border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        /**
         * CTA — **되돌리기 어려운 주 행동 전용.** 알림장 발행, 등원 확정, 하루 마감,
         * 결제. 화면당 **최대 하나**다.
         *
         * `default`(인디고)와 색을 나눈 이유: 브랜드 색 하나로 모든 버튼을 칠하면
         * 한 화면에 파란 버튼이 예닐곱 개 생기고, 그 순간 색은 "누르라는 뜻"이 아니라
         * 그냥 버튼의 생김새가 된다. 정말 눌러야 하는 것을 가리킬 수단이 없어진다.
         *
         * ⚠️ 두 개를 나란히 쓰지 말 것. 둘 다 CTA 면 둘 다 CTA 가 아니다.
         */
        cta: "bg-cta text-cta-foreground hover:bg-cta-hover",
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
       * 크기 스케일 (mini SaaS · density 7/10).
       *
       * ## 밀도는 터치 타깃이 아니라 데스크톱 치수에서 뺀다
       *
       * 이 제품의 사용 환경은 **손이 젖어 있거나 목줄을 잡은 채 한 손 조작**이다.
       * 그 사실은 스타일을 바꿔도 사라지지 않는다. 그래서 콘솔 밀도를 올리면서도
       * **손가락으로 누르는 것의 바닥은 44px 로 지킨다**(WCAG 2.5.5 / iOS 44pt).
       * 밀도가 필요한 자리는 `control`(36px) 로 따로 열어 두었고, 그건 **마우스를
       * 전제한 데스크톱 표·툴바 전용**이다.
       *
       *   xs      36px — @pawlog/ui 내부 조립용(combobox 안의 clear 등). 화면 코드 금지
       *   control 36px — **데스크톱(lg+) 표 안 버튼·툴바.** 마우스를 전제한다
       *   sm      40px — 밀집한 카드 안 보조 버튼. 손가락으로도 누를 수 있는 하한 근처
       *   default 44px — **기본.** 손가락으로 누르는 모든 곳
       *   lg      44px — 하단 고정 주 행동. 높이는 같고 패딩·글자가 크다
       *
       * ⚠️ **`apps/web` 의 모바일 화면에서 `control`/`xs` 를 쓰지 않는다.** 쓰려면
       * `lg:` 로 데스크톱에 한정한다 — 어기면 젖은 손 요구사항이 조용히 깨지고,
       * 화면은 멀쩡해 보이며 현장에서만 틀린다.
       *
       * 이전 값(job-052: sm 48 / default 64 → job-060: 52)에서 내려온 것이다.
       * **현장에서 오조작이 늘면 여기를 가장 먼저 되돌린다.**
       */
      size: {
        default:
          "h-touch gap-2 px-4 text-body-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        xs: "h-control gap-1 px-2.5 text-label in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        control:
          "h-control gap-1.5 px-3 text-label in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-10 gap-1.5 px-3.5 text-body-sm in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-touch gap-2 px-6 text-body font-semibold has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-touch [&_svg:not([class*='size-'])]:size-4",
        "icon-xs":
          "size-control in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-10 in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-touch [&_svg:not([class*='size-'])]:size-5",
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
