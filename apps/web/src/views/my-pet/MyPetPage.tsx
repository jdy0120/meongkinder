import { PageShell } from "@/shared/ui";
import { CreateMyPetDialog } from "@/features/pet/create-my-pet";
import { PetProfileList } from "@/widgets/pet-profile";
import { MobileNav } from "@/widgets/mobile-nav";
import { ProfileAvatar } from "@/widgets/profile-avatar";

/** 아이 정보 화면 (view) — 내 반려동물 목록/상세와 정보 수정 요청을 widget 에 위임해 조합한다. */
export const MyPetPage = () => (
  <PageShell
    title='아이 정보'
    width='md'
    action={
      <div className='flex items-center gap-2'>
        <CreateMyPetDialog />
        <ProfileAvatar />
      </div>
    }
    nav={<MobileNav />}
  >
    <PetProfileList />
  </PageShell>
);
