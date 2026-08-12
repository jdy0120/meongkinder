import * as React from "react";

import { cn } from "../../lib/utils";

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        // job-057: 최소 높이를 터치 타겟(64px)에 맞추고, 좌우 여백·글자 크기를 Input 과
        // 같게 둔다. 한 폼 안에서 입력칸마다 안쪽 여백이 다르면 글자 시작선이 어긋난다.
        // `md:text-sm` 은 뺐다 — 뷰포트에 따라 이것만 글자가 줄어들던 자리다.
        "flex field-sizing-content min-h-touch w-full rounded-lg border border-input bg-transparent px-4 py-3 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
