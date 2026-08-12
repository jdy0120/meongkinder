"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button, Input, Label } from "@pawlog/ui";
import type { TenantAddressInput } from "@pawlog/shared";

const POSTCODE_SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/** 다음 우편번호 서비스가 `oncomplete` 로 주는 값 중 실제로 쓰는 것만. */
interface DaumPostcodeResult {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
}

interface DaumPostcodeConstructor {
  new (options: {
    oncomplete: (data: DaumPostcodeResult) => void;
  }): { open: () => void };
}

declare global {
  interface Window {
    daum?: { Postcode: DaumPostcodeConstructor };
  }
}

/**
 * 스크립트를 **필요할 때 한 번만** 넣는다.
 *
 * 레이아웃에 상시 로드하면 주소를 쓰지 않는 화면(대부분)까지 외부 스크립트를 받는다.
 * 진행 중인 로드를 프라미스로 공유해, 버튼을 연타해도 태그가 여러 개 생기지 않게 한다.
 */
let postcodeLoader: Promise<void> | null = null;

const loadPostcodeScript = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.daum?.Postcode) return Promise.resolve();
  if (postcodeLoader) return postcodeLoader;

  postcodeLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // 다음에 다시 시도할 수 있도록 실패한 프라미스를 남겨두지 않는다.
      postcodeLoader = null;
      reject(new Error("주소 검색을 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });

  return postcodeLoader;
};

interface AddressFieldProps {
  value: TenantAddressInput;
  onChange: (value: TenantAddressInput) => void;
  /** 라벨 아래에 붙는 보조 설명. 화면마다 맥락이 달라 주입받는다. */
  description?: string;
}

/**
 * 매장 주소 입력 (job-059).
 *
 * **직접 타이핑하게 두지 않고 주소 검색으로만 받는다.** 좌표는 서버가 이 주소를
 * 지오코딩해서 채우는데, 손으로 쓴 주소는 표기가 조금만 달라도 좌표를 못 얻는다.
 * 검색으로 고른 도로명 주소는 카카오가 아는 형태라 실패 확률이 크게 낮다.
 *
 * 상세주소(층/호)만 자유 입력이다 — 그건 지오코딩에 쓰이지 않는다.
 */
export const AddressField = ({
  value,
  onChange,
  description,
}: AddressFieldProps) => {
  const [error, setError] = useState<string | null>(null);
  // 팝업 콜백은 열릴 때의 onChange 를 붙잡으므로, 최신 값을 ref 로 읽어 stale 을 피한다.
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  });

  const openSearch = useCallback(async () => {
    setError(null);
    try {
      await loadPostcodeScript();
      const Postcode = window.daum?.Postcode;
      if (!Postcode) throw new Error("주소 검색을 불러오지 못했습니다.");

      new Postcode({
        oncomplete: (data) => {
          // 도로명이 없는 지역이 있어 지번으로 떨어뜨린다. 좌표 변환은 둘 다 받는다.
          const road = data.roadAddress || data.jibunAddress;
          latest.current.onChange({
            ...latest.current.value,
            postalCode: data.zonecode,
            roadAddress: road,
          });
        },
      }).open();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "주소 검색을 불러오지 못했습니다.",
      );
    }
  }, []);

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1.5'>
        <Label>주소</Label>
        {description && (
          <p className='text-label text-muted-foreground'>{description}</p>
        )}
      </div>

      <div className='flex gap-2'>
        <Input
          readOnly
          value={value.postalCode ?? ""}
          placeholder='우편번호'
          className='w-32'
        />
        <Button type='button' variant='outline' onClick={openSearch}>
          <Search className='size-4' />
          주소 검색
        </Button>
      </div>

      <Input
        readOnly
        value={value.roadAddress ?? ""}
        placeholder='주소 검색 버튼을 눌러 선택하세요'
      />

      <Input
        value={value.addressDetail ?? ""}
        placeholder='상세주소 (건물명·층·호)'
        onChange={(event) =>
          onChange({ ...value, addressDetail: event.target.value })
        }
      />

      {error && <p className='text-label text-destructive'>{error}</p>}

      {value.roadAddress && (
        <button
          type='button'
          className='self-start text-label text-muted-foreground underline'
          onClick={() =>
            onChange({ postalCode: "", roadAddress: "", addressDetail: "" })
          }
        >
          주소 지우기
        </button>
      )}
    </div>
  );
};
