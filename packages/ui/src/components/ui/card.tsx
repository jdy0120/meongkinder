import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * 카드 (mini SaaS · Swiss).
 *
 * ⚠️ **`ring-1 ring-foreground/10` 을 `border` 로 바꿨다.** 셋이 함께 달라진다:
 *   ① `ring` 은 레이아웃 밖(바깥쪽)에 그려져 카드끼리 맞붙을 때 선이 겹쳐 두꺼워진다.
 *      `border` 는 박스 안에 있어 표·격자에서 간격이 일정하게 유지된다.
 *   ② `ring` 은 `focus-visible:ring` 과 **같은 속성**이라, 카드 안 요소에 초점이 갔을 때
 *      두 링이 서로를 덮는 경우가 있었다.
 *   ③ Swiss 방향에서 카드는 그림자가 아니라 **선**으로 선다(tokens.css 의 elevation-sm
 *      을 거의 0으로 내린 것과 짝이다). 선이 구조를 만들면 그림자는 "떠 있음"이라는
 *      진짜 신호로 남는다.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot='card'
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-3 overflow-hidden rounded-card border border-border bg-card py-4 text-sm text-card-foreground has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-2 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-card *:[img:last-child]:rounded-b-card",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-header'
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-title'
      className={cn(
        "text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-description'
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-action'
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-content'
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  );
}

function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='card-footer'
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
