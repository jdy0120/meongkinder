"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Button,
  Checkbox,
  Field,
  FieldLabel,
  Input,
  Label,
} from "@pawlog/ui";
import type { PendingRequiredTerms } from "@pawlog/shared";

import { TermsContentDialog } from "@/entities/terms";
import { PhoneVerifyField } from "@/features/auth/verify-phone";

import { useCompleteProfile } from "../model/useCompleteProfile";

interface CompleteProfileFormProps {
  /** 아직 동의하지 않은 활성 필수 약관 (서버가 판단해 내려준다) */
  terms: PendingRequiredTerms[];
  /** 이미 계정에 전화번호가 있으면 입력칸을 감춘다 */
  hasPhone: boolean;
}

/**
 * 최초 진입 완료 폼 (feature ui) — 필수 약관 동의 + (선택) 전화번호.
 *
 * ## 순서
 *
 * 약관을 먼저 두고 전화번호를 아래에 둔다. 번호를 받는 근거가 개인정보처리방침 동의이기
 * 때문이고, 서버도 같은 순서로 검증한다(동의가 없으면 번호를 저장조차 하지 않는다).
 *
 * ## 전화번호는 건너뛸 수 있다
 *
 * 매장에 다니지 않는 개인 보호자에게는 필요 없고, 첫 화면에서 막으면 이탈한다. 대신
 * **건너뛰면 무엇을 잃는지 명시한다** — 가입 전 유치원이 등록해 둔 아이·알림장은 번호가
 * 유일한 연결 키라서, 안 넣으면 그 기록이 계정에 붙지 않는다. 나중에 프로필에서 넣어도
 * 같은 연결이 돌아간다는 것까지 적어야 "지금 안 넣으면 영영 못 한다"는 오해가 없다.
 */
export const CompleteProfileForm = ({
  terms,
  hasPhone,
}: CompleteProfileFormProps) => {
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [phone, setPhone] = useState("");
  // job-042: 본인확인을 마쳐야 번호를 저장할 수 있다(서버도 같은 검사를 한다).
  const [phoneVerified, setPhoneVerified] = useState(false);
  const completeProfile = useCompleteProfile();

  const allAgreed = terms.every((item) => agreed[item.id]);
  const allChecked = terms.length > 0 && allAgreed;

  const toggleAll = (next: boolean) =>
    setAgreed(
      Object.fromEntries(terms.map((item) => [item.id, next])) as Record<
        string,
        boolean
      >,
    );

  const submit = () => {
    if (!allAgreed) return;
    completeProfile.mutate({
      agreements: terms.map((item) => ({ termsId: item.id, isAgreed: true })),
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div className='flex flex-col gap-4'>
      <section className='flex flex-col gap-3'>
        <div className='flex items-center gap-2 rounded-xl border p-3'>
          <Checkbox
            id='agree-all'
            checked={allChecked}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <Label htmlFor='agree-all' className='text-sm font-medium'>
            약관에 모두 동의합니다
          </Label>
        </div>

        <div className='flex flex-col gap-2 px-1'>
          {terms.map((item) => (
            <div key={item.id} className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id={item.id}
                  checked={Boolean(agreed[item.id])}
                  onCheckedChange={(checked) =>
                    setAgreed((prev) => ({
                      ...prev,
                      [item.id]: checked === true,
                    }))
                  }
                />
                <Label htmlFor={item.id} className='text-sm'>
                  <span className='text-destructive'>[필수]</span> {item.title}
                </Label>
              </div>
              <TermsContentDialog termsId={item.id} title={item.title} />
            </div>
          ))}
        </div>
      </section>

      {!hasPhone && (
        <section className='flex flex-col gap-2'>
          <PhoneVerifyField
            value={phone}
            onChange={setPhone}
            onVerifiedChange={setPhoneVerified}
            label='휴대폰 번호 (선택)'
            description='번호로 등록된 아이를 연결하려면 본인확인이 필요합니다. 이 번호 하나로 그 아이의 알림장·사진이 열리기 때문입니다.'
          />

          <div className='flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground'>
            <Info className='mt-0.5 size-4 shrink-0' />
            <p>
              번호를 입력하지 않고 넘어가면{" "}
              <span className='font-medium text-foreground'>
                가입 전 유치원에서 등록해 둔 아이 정보와 알림장을 연결할 수
                없어요.
              </span>{" "}
              비회원으로 이용하던 기록은 이 번호로만 찾을 수 있습니다. 나중에
              프로필에서 번호를 입력하면 그때 연결됩니다.
            </p>
          </div>
        </section>
      )}

      <Button
        onClick={submit}
        disabled={
          !allAgreed ||
          completeProfile.isPending ||
          // 번호를 입력했다면 본인확인까지 마쳐야 한다. 안 그러면 서버가 400 을 준다.
          (Boolean(phone.trim()) && !phoneVerified)
        }
        className='w-full'
      >
        {completeProfile.isPending
          ? "저장 중…"
          : phone.trim() || hasPhone
            ? "시작하기"
            : "번호 없이 시작하기"}
      </Button>
    </div>
  );
};
