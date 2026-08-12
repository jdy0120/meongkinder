import * as React from "react";

import { cn } from "../../lib/utils";
import { ChevronDownIcon } from "lucide-react";

type NativeSelectProps = Omit<
  React.ComponentProps<"select">,
  "size"
> & {
  size?: "sm" | "default";
};

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        // `w-fit` 이면 폼에서 셀렉트만 폭이 제각각이 된다 — 안쪽 select 가 `w-full` 이라
        // 래퍼가 폭을 정하는데, 호출부는 대개 `<div className='flex flex-col'>` 안에
        // Input 과 함께 두고 같은 폭을 기대한다. 필요하면 className 으로 좁히면 된다.
        "group/native-select relative w-full has-[select:disabled]:opacity-50",
        className,
      )}
      data-slot='native-select-wrapper'
      data-size={size}
    >
      <select
        data-slot='native-select'
        data-size={size}
        // job-057: Input·Button 과 같은 눈금 (default 64px / sm 48px). 이 셀렉트는
        // 폼 안에서 Input 과 위아래로 나란히 놓이므로, 여기만 32px 로 남으면 같은 폼의
        // 칸 높이가 두 가지가 된다.
        className='h-touch w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-10 pl-4 text-body transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-12 data-[size=sm]:pl-3 data-[size=sm]:text-label dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'
        {...props}
      />
      <ChevronDownIcon
        className='pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none'
        aria-hidden='true'
        data-slot='native-select-icon'
      />
    </div>
  );
}

function NativeSelectOption({
  ...props
}: React.ComponentProps<"option">) {
  return <option data-slot='native-select-option' {...props} />;
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot='native-select-optgroup'
      className={cn(className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
