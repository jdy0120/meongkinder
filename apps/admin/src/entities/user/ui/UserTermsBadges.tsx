import type { UserWithAgreements } from "@pawlog/shared";

type Agreement = NonNullable<UserWithAgreements["termsAgreements"]>[number];

/**
 * 약관 종류별 표시 설정.
 *
 * `required` 는 **미동의가 문제인지**를 가른다. 필수 약관 미동의는 서비스를 쓸 수 없는
 * 상태라 `critical` 이지만, 마케팅 수신 미동의는 그냥 사용자의 선택이라 아무 색도 붙지
 * 않아야 한다 — 예전에는 셋 다 빨간색으로 그려서 정상 계정이 문제처럼 보였다.
 */
const ROWS: { label: string; type: string; required: boolean }[] = [
  { label: "이용약관", type: "SERVICE_USE", required: true },
  { label: "개인정보", type: "PRIVACY_POLICY", required: true },
  { label: "마케팅", type: "MARKETING_RECEIPT", required: false },
];

/** 사용자의 약관 동의 현황 뱃지 목록 (entity ui) */
export const UserTermsBadges = ({
  agreements,
}: {
  agreements?: Agreement[];
}) => {
  return (
    <div className='flex min-w-[170px] flex-col gap-1 text-meta'>
      {ROWS.map((row) => {
        const agreement = agreements?.find((a) => a.terms.type === row.type);
        const agreed = Boolean(agreement?.isAgreed);
        return (
          <div key={row.type} className='flex items-center gap-1.5'>
            <span className='w-[50px] shrink-0 text-text-meta'>
              {row.label}:
            </span>
            {agreed ? (
              <span className='rounded-chip bg-success-tint px-1.5 py-0.5 font-semibold text-success-text'>
                동의 (v{agreement?.terms.version})
              </span>
            ) : (
              <span
                className={`rounded-chip px-1.5 py-0.5 font-semibold ${
                  row.required
                    ? "bg-danger-tint text-danger-strong"
                    : "bg-secondary text-text-meta"
                }`}
              >
                미동의
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
