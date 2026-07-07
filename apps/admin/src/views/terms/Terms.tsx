import { ShieldCheck } from "lucide-react";

import { CreateTermsDialog } from "@/features/terms/create-terms";
import { TermsTable } from "@/widgets/terms-table";

/**
 * 약관 관리 페이지 (view). 헤더 + 등록 다이얼로그(feature) + 목록 위젯 조합만 담당한다.
 */
export const TermsPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-bold tracking-tight text-white flex items-center gap-2'>
            <ShieldCheck className='w-6 h-6 text-blue-500' />
            약관 관리
          </h1>
          <p className='text-slate-400 text-sm'>
            서비스에 적용될 회원 약관 버전을 등록하고, 약관 파일을 업로드 및
            활성화합니다.
          </p>
        </div>

        <CreateTermsDialog />
      </div>

      <TermsTable />
    </div>
  );
};
