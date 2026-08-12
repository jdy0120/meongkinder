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
  // job-051: `useState(new QueryClient(...))` 는 **렌더마다 QueryClient 를 새로 만든다**
  // (첫 결과만 쓰이고 나머지는 버려진다). 즉시 GC 되므로 누수는 아니지만, 리렌더마다
  // 불필요한 인스턴스가 생긴다. 초기화 함수를 넘겨 한 번만 만든다.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false, // 윈도우가 다시 포커스되었을 때 refetch
            // ⚠️ `refetchOnMount: false` 를 다시 넣지 말 것.
            //
            // 그 값이 있으면 **`invalidateQueries` 가 화면에 반영되지 않는다.** 무효화는
            // 기본적으로 *활성(마운트된)* 쿼리만 다시 부르고, 비활성 쿼리는 stale 표시만
            // 남긴다. 목록이 마운트될 때 stale 이면 다시 부르는 것이 그 표시를 실제 갱신으로
            // 바꾸는 유일한 지점인데, 그걸 꺼두면 표시만 남고 아무 일도 일어나지 않는다.
            //
            // 이 조합이 정확히 "쓰고 나서 이동하는" 흐름을 깬다 — 작성 화면은 목록과 다른
            // 라우트라, 뮤테이션이 도는 순간 목록 쿼리는 언마운트돼 비활성 상태다:
            //   피드 업로드(`/tenant/x/feed/new`) → 목록(`/tenant/x/feed`) 이 예전 그대로
            //   알림장 작성 → 리포트 목록도 같은 모양 (`DailyReportForm.tsx:309`)
            // 새로고침하면 메모리 캐시가 통째로 사라져서 고쳐진 것처럼 보이는데, 그래서
            // "새로고침해야 보인다"로 나타난다.
            //
            // 캐싱이 필요한 쿼리는 각자 `staleTime` 을 선언한다(약관 5분, 파일 URL 30분).
            // 기본값은 "항상 최신"이고 캐싱은 opt-in 이다.
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
