import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-transparent px-2 py-0.5 text-label font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      /**
       * ⚠️ 상태를 나타내는 배지는 아래 **normal / caution / critical 3단계만** 쓴다
       * (design-system.md §3.1). 나머지 variant 는 상태가 아닌 배지(라벨·태그)용이다.
       *
       * 배지 색은 **분류가 아니라 긴급도만** 인코딩한다. 견종별·성향별로 색을 다르게
       * 주면 사용자는 색을 읽지 않고 글자만 읽게 되고, 그 순간 배지는 장식이 된다.
       */
      variant: {
        /** 확인 완료, 신경 쓸 필요 없음 — 접종 정상, 중성화 완료 */
        normal: "bg-primary-tint text-primary-on-tint",
        /** 오늘 신경 써야 함 — 알러지, 마킹 잦음, 접종 D-9, 분리불안 */
        caution: "bg-caution-tint text-caution-text",
        /** 지금 조치 필요 — 종합백신 만료, 공격 이력, 미도착 */
        critical: "bg-danger text-white",

        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot='badge'
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
