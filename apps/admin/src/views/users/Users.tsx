import { PlatformUsersTable } from "@/widgets/platform-users-table";

/**
 * 전 플랫폼 회원 관리 페이지 (view).
 * 매장 단위 구성원 관리와 다르다 — 여기는 테넌트를 가로지르는 계정 자체의 관리다.
 */
export const UsersPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          회원 관리
        </h1>
        <p className='text-sm text-slate-400'>
          플랫폼 전체 회원을 조회하고 계정 정지·삭제, 플랫폼 관리자 승격을
          처리합니다. 매장 안에서의 자격(보호자·스태프·관리자)은 각 매장의 구성원
          관리에서 다룹니다.
        </p>
      </div>

      <PlatformUsersTable />
    </div>
  );
};
