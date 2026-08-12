"use client";

import { forwardRef } from "react";
import { Input } from "@pawlog/ui";
import { formatPhone, normalizePhone, PHONE_MAX_DIGITS } from "@pawlog/shared";

interface PhoneInputProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof Input>,
    "value" | "onChange" | "type"
  > {
  /** 숫자만 담긴 값 (저장 형태). 화면에는 하이픈을 붙여 보여준다. */
  value: string;
  /** 숫자만 담긴 값으로 올라온다 — 폼과 서버가 보는 것은 언제나 숫자열이다. */
  onChange: (digits: string) => void;
}

/**
 * 전화번호 입력 (job-043).
 *
 * **화면은 하이픈, 값은 숫자만.** 표시와 저장을 분리하는 이유는 이 번호가 단순한 표시
 * 데이터가 아니라 **매칭 키**이기 때문이다 — 매장이 등록해 둔 아이를 보호자가 가입하며
 * 찾을 때(`claimForUser`), 한쪽이 "010-1234-5678" 이고 다른 쪽이 "01012345678" 이면
 * 그 연결이 조용히 실패한다.
 *
 * 입력 단계에서 숫자가 아닌 문자는 아예 들어오지 않게 막는다(붙여넣기 포함). 하이픈은
 * 사용자가 치는 것이 아니라 화면이 그려주는 것이므로, 지우기도 자연스럽게 동작한다 —
 * 하이픈 위치에서 백스페이스를 누르면 앞의 숫자가 지워지고 서식이 다시 계산된다.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "010-0000-0000", ...props }, ref) => (
    <Input
      ref={ref}
      type='tel'
      inputMode='numeric'
      autoComplete='tel'
      // 하이픈까지 포함한 최대 길이(011-1234-5678 = 13). 숫자 자체는 아래에서 자른다.
      maxLength={PHONE_MAX_DIGITS + 2}
      placeholder={placeholder}
      value={formatPhone(value)}
      onChange={(event) =>
        onChange(normalizePhone(event.target.value).slice(0, PHONE_MAX_DIGITS))
      }
      {...props}
    />
  ),
);

PhoneInput.displayName = "PhoneInput";
