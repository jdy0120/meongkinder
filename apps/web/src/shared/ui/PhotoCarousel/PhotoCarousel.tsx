"use client";

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@pawlog/ui";

/** 점을 나열하는 상한. 넘어가면 "3 / 12" 카운터로 바꾼다 — 12개 점은 세어지지 않는다. */
const MAX_DOTS = 8;

interface PhotoCarouselProps<T> {
  items: T[];
  /** 슬라이드 한 장을 그린다. */
  render: (item: T, index: number) => React.ReactNode;
  /** 스크린리더용 이름 (예: "피드 사진"). */
  label: string;
  /** 현재 보이는 장이 바뀔 때. 사진별 부가 정보(태그 등)를 따라 바꾸는 데 쓴다. */
  onIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * 가로 스와이프 사진 캐러셀 (인스타그램식).
 *
 * ## 왜 그리드가 아니라 스와이프인가
 *
 * 사진 여러 장을 2열 그리드로 깔면 장수가 늘수록 카드가 세로로 길어져, 피드를 내리는 동안
 * **게시물 하나가 화면을 다 먹는다**. 한 장씩 넘기면 카드 높이가 장수와 무관하게 고정되어
 * 그 아래 게시물이 계속 보인다. 12장을 한 번에 올리는 이 제품에서는 차이가 크다.
 *
 * ## §7 "스와이프 MUST NOT" 과 어긋나지 않는다
 *
 * design-system.md §7 이 금지하는 것은 **스와이프로 주요 액션(등하원·삭제)을 트리거하는 것**
 * 이다 — 빗나가면 되돌릴 것이 생기기 때문이다. 여기서 스와이프는 조회일 뿐이라 실패해도
 * 잃는 것이 없고, 데스크톱을 위해 화살표 버튼이라는 두 번째 경로도 함께 둔다(§7 "유일한
 * 진입 경로로 쓰지 않는다").
 *
 * 캐러셀 엔진은 `@pawlog/ui` 의 `Carousel`(embla)을 그대로 쓴다. 여기서 더하는 것은
 * **인스타식 표식**뿐이다 — 점/카운터, 그리고 "지금 몇 번째"를 바깥에 알려 주는 콜백
 * (사진마다 태그가 다르므로 카드가 이걸 따라 바꿔 그린다).
 */
export const PhotoCarousel = <T,>({
  items,
  render,
  label,
  onIndexChange,
  className,
}: PhotoCarouselProps<T>) => {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const sync = () => setIndex(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  // 한 장이면 캐러셀이 아니다 — 점도 화살표도 붙이지 않는다.
  if (items.length <= 1) {
    return (
      <div className={className}>
        {items.map((item, i) => (
          <div key={i}>{render(item, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start" }}
      className={className}
      aria-label={label}
    >
      {/* 기본 스타일의 `-ml-4`/`pl-4` 는 카드 사이 간격용이다. 사진은 카드 폭을
          꽉 채워야 하므로(인스타처럼 여백 없이) 양쪽 다 0 으로 되돌린다. */}
      <CarouselContent className='ml-0'>
        {items.map((item, i) => (
          <CarouselItem key={i} className='pl-0'>
            {render(item, i)}
          </CarouselItem>
        ))}
      </CarouselContent>

      {/*
       * 데스크톱 보조 경로. 기본 위치가 프레임 **바깥**(-left-12)이라 카드 안에서는
       * 잘려 보이지 않으므로 사진 위로 끌어온다. 터치 기기에서는 스와이프가 있으니 숨긴다.
       */}
      <CarouselPrevious className='left-2 hidden border-0 bg-black/45 text-white hover:bg-black/65 hover:text-white md:flex' />
      <CarouselNext className='right-2 hidden border-0 bg-black/45 text-white hover:bg-black/65 hover:text-white md:flex' />

      {items.length > MAX_DOTS ? (
        <span className='pointer-events-none absolute top-3 right-3 rounded-pill bg-black/55 px-3 py-1 text-label font-semibold text-white tabular-nums'>
          {index + 1} / {items.length}
        </span>
      ) : (
        <div
          className='pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5'
          aria-hidden
        >
          {items.map((_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.45)] transition-colors ${
                i === index ? "bg-white" : "bg-white/45"
              }`}
            />
          ))}
        </div>
      )}
    </Carousel>
  );
};
