"use client";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function ReactQueryProvider({
  children,
}: React.PropsWithChildren) {
  // `useState(new QueryClient(...))` 는 렌더마다 인스턴스를 새로 만든다(첫 결과만 쓰인다).
  // 초기화 함수를 넘겨 한 번만 만든다 — apps/web 과 같은 설정을 유지한다.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false, // 윈도우가 다시 포커스되었을 때 refetch
            // ⚠️ `refetchOnMount: false` 를 다시 넣지 말 것 — `invalidateQueries` 가
            // 비활성(언마운트된) 쿼리에는 stale 표시만 남기므로, 마운트 시 재조회를 끄면
            // "쓰고 나서 다른 화면으로 이동" 하는 흐름에서 목록이 영영 갱신되지 않는다.
            // 자세한 설명은 apps/web 의 같은 파일에 있다.
            retry: 1, // API 요청 실패시 재시도 하는 옵션 (설정값 만큼 재시도)
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
