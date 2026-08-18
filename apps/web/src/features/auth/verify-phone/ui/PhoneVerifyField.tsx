"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@pawlog/ui";

import { PhoneInput } from "@/shared/ui";
import { useRequestPhoneOtp, useVerifyPhoneOtp } from "../model/usePhoneOtp";

interface PhoneVerifyFieldProps {
  value: string;
  onChange: (phone: string) => void;
  /** 인증 상태가 바뀔 때. 부모는 이 값이 true 일 때만 저장을 허용해야 한다. */
  onVerifiedChange: (verified: boolean) => void;
  label?: string;
  description?: string;
}

const format = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/**
 * 휴대폰 본인확인 입력 (job-042).
 *
 * ## 이 화면이 막는 것
 *
 * 전화번호는 이 서비스에서 **소유권의 열쇠**다. 매장이 미가입 보호자의 아이를 번호로
 * 등록해 두고, 그 번호로 가입한 사람에게 아이·알림장·사진이 넘어간다. 번호가
 * 자기신고인 동안은 남의 번호를 입력하는 것만으로 남의 기록에 닿을 수 있었다.
 *
 * ## 상태가 셋이다
 *
 *   1. 입력 중        — 번호만 있고 아직 요청 안 함
 *   2. 코드 대기      — 문자를 보냈고 카운트다운이 도는 중
 *   3. 확인 완료      — 저장 가능
 *
 * **번호를 고치면 3에서 1로 되돌린다.** 인증한 번호와 저장할 번호가 다르면 서버가
 * 어차피 거절하는데, 화면이 "확인됨"을 유지하면 사용자는 왜 저장이 안 되는지 모른다.
 */
export const PhoneVerifyField = ({
  value,
  onChange,
  onVerifiedChange,
  label = "휴대폰 번호",
  description,
}: PhoneVerifyFieldProps) => {
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [remaining, setRemaining] = useState(0);
  // 인증을 마친 번호. 이 값과 현재 입력이 어긋나면 인증을 무효로 본다.
  const verifiedPhone = useRef<string | null>(null);

  // 이미 다른 계정이 쓰는 번호일 때의 안내. 문자는 나가지 않는다(서버가 발송 전에 막는다).
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const request = useRequestPhoneOtp({
    onSent: (expiresInSec) => {
      setRemaining(expiresInSec);
      setCode("");
    },
    onDuplicate: setDuplicateMessage,
  });

  const verify = useVerifyPhoneOtp(() => {
    verifiedPhone.current = value;
    setVerified(true);
    setRemaining(0);
    onVerifiedChange(true);
  });

  // 카운트다운. 0 이 되면 서버의 코드도 만료됐으므로 입력칸을 닫는다.
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const handlePhoneChange = (next: string) => {
    onChange(next);
    // 인증을 마친 뒤 번호를 고치면 인증은 무효다.
    if (verified && next !== verifiedPhone.current) {
      setVerified(false);
      verifiedPhone.current = null;
      onVerifiedChange(false);
      setRemaining(0);
    }
  };

  const waitingForCode = remaining > 0 && !verified;

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1.5'>
        <Label>{label}</Label>
        {description && (
          <p className='text-label text-muted-foreground'>{description}</p>
        )}
      </div>

      <div className='flex gap-2'>
        {/* 인증 후에도 잠그지 않는다. 잠그면 `handlePhoneChange` 가 대비해 둔 "인증한 뒤
            번호를 고치는" 경로에 아예 닿을 수 없어, 번호를 잘못 인증한 사람은 화면을
            새로 고치는 것 말고 방법이 없다. 고치면 인증이 무효가 되므로 안전하다. */}
        <PhoneInput value={value} onChange={handlePhoneChange} />
        <Button
          type='button'
          variant='outline'
          className='shrink-0'
          disabled={!value || verified || request.isPending}
          onClick={() => request.mutate(value)}
        >
          {request.isPending
            ? "전송 중…"
            : waitingForCode
              ? "재발송"
              : "인증요청"}
        </Button>
      </div>

      {waitingForCode && (
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <Input
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder='인증번호 6자리'
              inputMode='numeric'
              autoComplete='one-time-code'
            />
            <span className='absolute right-4 top-1/2 -translate-y-1/2 text-label text-muted-foreground'>
              {format(remaining)}
            </span>
          </div>
          <Button
            type='button'
            className='shrink-0'
            disabled={code.length !== 6 || verify.isPending}
            onClick={() => verify.mutate({ phone: value, code })}
          >
            {verify.isPending ? "확인 중…" : "확인"}
          </Button>
        </div>
      )}

      {verified && (
        <p className='flex items-center gap-1.5 text-label text-primary'>
          <Check className='size-4' />
          본인확인이 완료되었습니다.
        </p>
      )}

      <Dialog
        open={duplicateMessage !== null}
        onOpenChange={(next: boolean) => !next && setDuplicateMessage(null)}
      >
        <DialogContent className='rounded-2xl sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>이미 등록된 휴대폰 번호입니다</DialogTitle>
            <DialogDescription>{duplicateMessage}</DialogDescription>
          </DialogHeader>

          {/* 무엇을 해야 하는지 적는다. 이 상태는 같은 번호로 다시 눌러도 영영 통과하지
              못하므로, 대안을 주지 않으면 사용자는 '인증요청'만 반복하다 이탈한다. */}
          <ul className='flex list-disc flex-col gap-1.5 pl-5 text-body text-muted-foreground'>
            <li>이전에 다른 계정으로 가입하셨다면 그 계정으로 로그인해주세요.</li>
            <li>번호를 잘못 입력하셨다면 다시 확인해주세요.</li>
            <li>본인 번호가 맞는데 계속 이렇게 나오면 유치원에 문의해주세요.</li>
          </ul>

          <DialogFooter>
            <Button
              type='button'
              className='w-full'
              onClick={() => {
                setDuplicateMessage(null);
                // 다른 번호를 넣도록 입력칸을 비워 준다 — 닫았을 때 막힌 번호가 그대로
                // 남아 있으면 무엇을 고쳐야 하는지 다시 헷갈린다.
                onChange("");
              }}
            >
              다른 번호 입력하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
