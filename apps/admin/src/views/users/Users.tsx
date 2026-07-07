import { UsersTable } from "@/widgets/users-table";

/**
 * 사용자 관리 페이지 (view). 헤더 + 목록 위젯 조합만 담당한다.
 */
export const UsersPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          사용자 관리
        </h1>
        <p className='text-slate-400 text-sm'>
          서비스 가입 사용자들의 역할 변경 및 전체 사용자 현황을 조회할 수
          있습니다.
        </p>
      </div>

      <UsersTable />
    </div>
  );
};
