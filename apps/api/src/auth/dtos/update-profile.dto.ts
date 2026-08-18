import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * 내 정보 수정 (job-039).
 *
 * 전화번호가 핵심이다 — 카카오 로그인은 전화번호를 주지 않으므로, 유치원이 전화번호로
 * 미리 등록해 둔 초대(TenantInvitation)와 매칭되려면 회원이 직접 입력해야 한다.
 * 저장 시 숫자만 남겨 정규화하고, 저장 직후 대기 중인 초대를 다시 확인한다.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: "닉네임" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nickname?: string;

  @ApiPropertyOptional({
    description: "휴대폰 번호. 하이픈 허용 — 저장 시 숫자만 남긴다.",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * 프로필 사진 (job-063). `v1/file/upload` 로 올린 임시 파일의 id.
   *
   * 빈 문자열이면 사진을 **지운다** — `undefined`(안 보냄)와 구분해야, 폼에서 사진을
   * 치운 것이 저장되지 않고 조용히 남는 일이 없다.
   */
  @ApiPropertyOptional({
    description: "프로필 사진 파일 id. 빈 문자열이면 삭제",
  })
  @IsOptional()
  @IsString()
  profileImageFileId?: string;

  /**
   * 알림 수신 번호를 함께 바꿀 아이들 (job-060).
   *
   * ## 왜 자동으로 하지 않는가
   *
   * 알림톡은 `resolveGuardianPhone` 이 정하는데 그 우선순위가
   * **`Pet.guardianPhone` → `User.phone`** 이다. 즉 매장이 현장에서 받아 적은 번호가
   * 계정 번호를 이긴다. 그래서 회원 정보에서 번호만 바꾸면 **알림톡은 계속 옛 번호로
   * 나간다** — 보호자는 알림이 안 와서 앱을 열어보고, 매장은 발송 성공 로그를 본다.
   *
   * 그렇다고 내 아이 전부를 조용히 덮으면 안 된다. 둘이 다른 것이 **정상인 경우**가
   * 있기 때문이다 — 부모 계정으로 가입했지만 실제 등하원과 연락은 자녀가 받는 식이라
   * 매장이 일부러 다른 번호를 적어 둔다. 덮으면 그 아이의 알림이 엉뚱한 곳으로 간다.
   *
   * 그래서 **화면이 물어보고, 사용자가 고른 것만** 넘어온다.
   *
   * ⚠️ 번호가 재활용된다는 점이 이 기능의 진짜 이유다. 통신사는 해지 번호를 몇 달 뒤
   * 다른 사람에게 재배정하므로, 옛 번호로 계속 발송하면 **남의 아이 사진과 공개 알림장
   * 링크가 모르는 사람에게 간다.** 공개 링크는 로그인이 필요 없어 그대로 열린다.
   */
  @ApiPropertyOptional({
    description:
      "알림 수신 번호를 새 번호로 함께 바꿀 반려동물 id 목록 (phone 과 함께 보낼 때만 유효)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  syncPetIds?: string[];
}
