import type { UserWithAgreements } from "@template/shared";

type Agreement = NonNullable<UserWithAgreements["termsAgreements"]>[number];

/** 약관 종류별 표시 설정 (동의/미동의 스타일) */
const ROWS: {
  label: string;
  type: string;
  agreeClass: string;
  disagreeClass: string;
}[] = [
  {
    label: "이용약관",
    type: "SERVICE_USE",
    agreeClass: "bg-green-500/10 text-green-400 border-green-500/20",
    disagreeClass: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  {
    label: "개인정보",
    type: "PRIVACY_POLICY",
    agreeClass: "bg-green-500/10 text-green-400 border-green-500/20",
    disagreeClass: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  {
    label: "마케팅",
    type: "MARKETING_RECEIPT",
    agreeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    disagreeClass: "bg-slate-800 text-slate-400 border-transparent",
  },
];

/** 사용자의 약관 동의 현황 뱃지 목록 (entity ui) */
export const UserTermsBadges = ({
  agreements,
}: {
  agreements?: Agreement[];
}) => {
  return (
    <div className='flex flex-col gap-1 text-[11px] min-w-[170px]'>
      {ROWS.map((row) => {
        const agreement = agreements?.find((a) => a.terms.type === row.type);
        return (
          <div key={row.type} className='flex items-center gap-1.5'>
            <span className='text-slate-400 w-[50px]'>{row.label}:</span>
            {agreement?.isAgreed ? (
              <span
                className={`px-1.5 py-0.5 rounded border font-medium ${row.agreeClass}`}
              >
                동의 (v{agreement.terms.version})
              </span>
            ) : (
              <span
                className={`px-1.5 py-0.5 rounded border font-medium ${row.disagreeClass}`}
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
