"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Get } from "@/shared/libs/axios/request";
import type { SubdomainAvailabilityResponse } from "@pawlog/shared";

const DEBOUNCE_MS = 400;
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** 입력 중 과도한 요청을 막기 위해 subdomain 값을 디바운스한다. */
const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

/** 서브도메인 사용 가능 여부를 디바운스하여 조회한다 (feature model). */
export const useSubdomainAvailability = (subdomain: string) => {
  const debounced = useDebouncedValue(subdomain.trim().toLowerCase(), DEBOUNCE_MS);
  const isValidFormat = SUBDOMAIN_RE.test(debounced) && debounced.length >= 2;

  const query = useQuery({
    queryKey: ["tenants", "subdomain-availability", debounced],
    queryFn: async () => {
      const res = await Get<SubdomainAvailabilityResponse, unknown>(
        "/v1/tenants/subdomain-availability",
        { subdomain: debounced },
      );
      return res.data.data;
    },
    enabled: isValidFormat,
    staleTime: 0,
  });

  return {
    ...query,
    // 디바운스 대기 중이거나 형식이 아직 유효하지 않으면 결과를 보여주지 않는다.
    result: isValidFormat && debounced === subdomain.trim().toLowerCase() ? query.data : undefined,
  };
};
