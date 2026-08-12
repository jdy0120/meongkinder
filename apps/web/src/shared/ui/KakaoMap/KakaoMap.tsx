"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 지도에 찍을 핀. 좌표가 없는 항목은 호출부가 걸러서 넘긴다. */
export interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

// ── 카카오 지도 SDK 최소 타입 ────────────────────────────────────────
// 전체 타입을 들여오면 의존성이 늘어나므로 실제로 부르는 것만 선언한다.
interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}
interface KakaoLatLngBounds {
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
}
interface KakaoMapInstance {
  getBounds: () => KakaoLatLngBounds;
  setCenter: (latlng: KakaoLatLng) => void;
}
interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}
interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  Marker: new (options: {
    position: KakaoLatLng;
    title?: string;
  }) => KakaoMarkerInstance;
  event: {
    addListener: (
      target: KakaoMapInstance | KakaoMarkerInstance,
      type: string,
      handler: () => void,
    ) => void;
  };
  load: (callback: () => void) => void;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

/** 서울시청. 좌표를 아직 모를 때의 초기 중심. */
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

let sdkLoader: Promise<void> | null = null;

/**
 * SDK 를 **필요할 때 한 번만** 넣는다. `autoload=false` 로 받고 `kakao.maps.load()` 로
 * 초기화가 끝난 뒤에 resolve 한다 — 이걸 안 기다리면 `kakao.maps.Map` 이 아직 없다.
 */
const loadKakaoSdk = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.kakao?.maps?.Map) return Promise.resolve();
  if (sdkLoader) return sdkLoader;

  sdkLoader = new Promise<void>((resolve, reject) => {
    if (!JS_KEY) {
      reject(new Error("지도 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 설정되지 않았습니다."));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao?.maps.load(() => resolve());
    script.onerror = () => {
      sdkLoader = null;
      reject(new Error("지도를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });

  return sdkLoader;
};

interface KakaoMapProps {
  markers: MapMarker[];
  /** 지도를 움직였을 때 현재 화면 영역. 호출부가 이 영역으로 목록을 다시 부른다. */
  onBoundsChange?: (bounds: MapBounds) => void;
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * 카카오 지도 (job-059).
 *
 * 매장 찾기가 이름 검색뿐이라 **이미 아는 매장만 찾을 수 있었다.** 보호자가 실제로 하는
 * 질문은 "우리 동네에 어디 있지?"라서, 지도가 그 질문의 답이다.
 *
 * ⚠️ 좌표가 없는 매장은 여기 오지 않는다. 그런 매장이 화면에서 통째로 사라지면 안 되므로
 * **호출부가 목록을 함께 보여줘야 한다** — 지도는 목록의 대체가 아니라 보조다.
 */
export const KakaoMap = ({
  markers,
  onBoundsChange,
  onSelect,
  className,
}: KakaoMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRefs = useRef<KakaoMarkerInstance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 콜백은 최신 것을 쓰되, 바뀔 때마다 지도를 다시 만들지는 않는다.
  const handlers = useRef({ onBoundsChange, onSelect });
  useEffect(() => {
    handlers.current = { onBoundsChange, onSelect };
  });

  const readBounds = useCallback((map: KakaoMapInstance): MapBounds => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return {
      swLat: sw.getLat(),
      swLng: sw.getLng(),
      neLat: ne.getLat(),
      neLng: ne.getLng(),
    };
  }, []);

  // 지도 생성 — 한 번만.
  useEffect(() => {
    let cancelled = false;

    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const maps = window.kakao!.maps;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: 6,
        });
        mapRef.current = map;
        setReady(true);

        maps.event.addListener(map, "idle", () => {
          handlers.current.onBoundsChange?.(readBounds(map));
        });
        // 첫 화면의 영역도 한 번 알려준다 — 안 그러면 지도를 움직이기 전까지 핀이 없다.
        handlers.current.onBoundsChange?.(readBounds(map));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "지도를 불러오지 못했습니다.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [readBounds]);

  // 핀 갱신 — 목록이 바뀔 때마다 전부 지우고 다시 그린다.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !window.kakao) return;
    const maps = window.kakao.maps;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = markers.map((item) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(item.latitude, item.longitude),
        title: item.name,
      });
      marker.setMap(map);
      maps.event.addListener(marker, "click", () => {
        handlers.current.onSelect?.(item.id);
      });
      return marker;
    });
  }, [markers, ready]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border bg-muted p-6 text-center text-label text-muted-foreground ${className ?? ""}`}
      >
        {error}
        <br />
        아래 목록에서 이름으로 검색할 수 있습니다.
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
};
