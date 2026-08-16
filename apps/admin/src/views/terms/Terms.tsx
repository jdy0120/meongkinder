import { ShieldCheck } from "lucide-react";

import { CreateTermsDialog } from "@/features/terms/create-terms";
import { TermsTable } from "@/widgets/terms-table";
import { PageHeader } from "@/shared/ui";

/**
 * 약관 관리 페이지 (view). 헤더 + 등록 다이얼로그(feature) + 목록 위젯 조합만 담당한다.
 */
export const TermsPage = () => {
  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='약관 관리'
        description='서비스에 적용될 회원 약관 버전을 등록하고, 약관 파일을 업로드 및 활성화합니다.'
        icon={<ShieldCheck className='size-6 text-brand' />}
        action={<CreateTermsDialog />}
      />
      <TermsTable />
    </div>
  );
};
