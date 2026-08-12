import { PageShell } from "@/shared/ui";
import { PetIntakeDialog } from "@/features/pet/intake-pet";
import { DogRoster } from "@/widgets/dog-roster";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 원생 관리 (view). 헤더 + 등록 다이얼로그(feature) + 목록 위젯 조합만 담당한다.
 *
 * job-052: 표 → 카드 목록으로 바뀌었다(design-system.md §6.1). 설명 문구도 줄였다 —
 * 이 화면에 들어온 사람은 이미 뭘 하러 왔는지 알고, 헤더 아래 두 줄짜리 설명은
 * 첫 화면에서 카드 한 장을 밀어낸다.
 */
export const PetsPage = () => {
  return (
    <PageShell
      title='원생 관리'
      action={<PetIntakeDialog />}
      width='md'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
    >
      <DogRoster />
    </PageShell>
  );
};
