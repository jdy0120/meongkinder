import type { Terms, UserTermsAgreement } from "@pawlog/database";

export interface TermsAgreementInput {
  termsId: string;
  isAgreed: boolean;
}

export interface SubmitTermsAgreementRequest {
  agreements: TermsAgreementInput[];
}

export interface SubmitTermsAgreementResponse {
  agreements: UserTermsAgreement[];
}

/**
 * 약관 상세.
 *
 * `content` 는 DB 컬럼이 아니라 **서비스가 파일에서 읽어 붙이는 값**이다
 * (`TermsService` 가 `Terms.fileId` → `File.localPath` 를 읽는다). Prisma 의 `Terms` 를
 * 그대로 extends 하면 이 칸이 빠져서, 동의 화면이 본문을 읽으려 할 때 타입 에러가 난다.
 * 파일이 없거나 읽기에 실패해도 서비스가 안내 문구를 채워 넣으므로 항상 문자열이다.
 */
export interface TermsDetail extends Terms {
  content: string;
}
