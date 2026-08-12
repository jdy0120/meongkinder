import { PawPrint } from "lucide-react";
import { Avatar, AvatarFallback } from "@pawlog/ui";

import { PhotoImage } from "@/entities/file";

/**
 * 반려동물 아바타.
 *
 * job-053: 사진이 있으면 실제로 보여준다. 예전에는 파일 서빙 경로가 없어 `profileImageFileId`
 * 가 있어도 항상 이니셜 폴백이었다. 원생 20마리를 훑을 때 **이름 첫 글자보다 얼굴이 빠르다** —
 * 특히 "초코"가 세 마리인 매장에서는 글자가 아무것도 구분해 주지 못한다.
 *
 * job-052: 색을 `orange-100/orange-600` 하드코딩에서 토큰으로 바꿨다. 팔레트 밖의 색은
 * 테마가 바뀌어도 따라오지 않고, 무엇보다 **분류마다 다른 색**을 쓰기 시작하는 입구가 된다
 * (design-system.md §3.1 — 색은 긴급도만 인코딩한다).
 */
export const PetAvatar = ({
  name,
  fileId,
  className,
}: {
  name: string;
  /** `Pet.profileImageFileId`. 없으면 이니셜/아이콘 폴백. */
  fileId?: string | null;
  className?: string;
}) => (
  <Avatar className={className}>
    {fileId ? (
      <PhotoImage
        fileId={fileId}
        alt={name}
        className='size-full object-cover'
      />
    ) : (
      <AvatarFallback className='bg-primary-tint text-primary-on-tint text-name'>
        {name ? name.charAt(0) : <PawPrint className='size-5' />}
      </AvatarFallback>
    )}
  </Avatar>
);
