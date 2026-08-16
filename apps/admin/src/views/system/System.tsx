import { SystemHealth } from "@/widgets/system-health";
import { PageHeader } from "@/shared/ui";

/**
 * 시스템 설정 페이지 (view). 헤더 + 서비스 상태판 위젯 조합만 담당한다.
 */
export const SystemPage = () => {
  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='시스템 설정'
        description='API 서버 · 데이터베이스 · Redis 의 실시간 헬스 상태를 확인할 수 있습니다. (10초마다 자동 갱신)'
      />
      <SystemHealth />
    </div>
  );
};
