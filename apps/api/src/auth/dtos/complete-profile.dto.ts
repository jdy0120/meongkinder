import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import type { CompleteProfileRequest } from "@pawlog/shared";
import { TermsAgreementInputDto } from "./signup.dto";

/**
 * 최초 진입 완료 (job-041).
 *
 * 카카오 로그인은 약관 동의 절차를 거치지 않아, `apps/web` 사용자는 전원 필수 약관에
 * 미동의한 상태로 계정이 만들어진다. 이 DTO 로 그 동의를 받고, 같은 화면에서 전화번호를
 * 함께 받는다.
 *
 * 전화번호는 **선택**이다. 매장에 다니지 않는 개인 보호자에게는 필요 없고 첫 화면에서
 * 막으면 이탈한다. 다만 건너뛰면 가입 전 유치원이 등록해 둔 아이·알림장을 연결할 수 없다
 * (그 연결의 유일한 키가 번호다). 필수/선택 여부와 그 대가는 서비스에서 강제한다.
 */
export class CompleteProfileDto implements CompleteProfileRequest {
  @ApiProperty({
    description:
      "약관 동의 목록. 활성 필수 약관은 전부 isAgreed=true 여야 한다.",
    type: [TermsAgreementInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermsAgreementInputDto)
  agreements!: TermsAgreementInputDto[];

  @ApiPropertyOptional({
    description:
      "휴대폰 번호(선택). 하이픈 허용 — 저장 시 숫자만 남긴다. 넣으면 비회원 시절 등록된 아이·매장이 연결된다.",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
