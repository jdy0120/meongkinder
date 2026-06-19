# Project Rules

이 프로젝트의 규칙과 컨벤션은 @\_bmad/core/project-context.md 를 따른다.
모든 작업 전 해당 파일을 반드시 읽고 준수할 것.

## 작업 영역 경계 (팀원은 자기 영역만 수정)

- apps/web/ — Next.js 어드민
- apps/api/ — NestJS 백엔드
- packages/shared/ — 공유 타입/유틸 (수정 시 다른 팀원에게 알릴 것)
  다른 영역 파일을 수정해야 하면 먼저 리드에게 보고하고 조율할 것.

## 금지 사항

- .env, 시크릿, Azure 자격증명 파일 절대 커밋 금지
- DB 스키마 변경(Prisma migration)은 백엔드 개발하는 Agent만 수정가능
- main 브랜치 직접 푸시 금지, 항상 브랜치/PR
- 기존 SAS URL 생성 로직 임의 변경 금지 (보안 영향)

## 컨벤션

- 언어: TypeScript strict, any 금지
- 커밋: Conventional Commits (feat:, fix:, chore:)
- 주석/문서는 한국어 OK, 코드 식별자는 영어

## 협업 규칙

- packages/shared 수정 시 영향받는 다른 팀원에게 메시지로 알릴 것
- 작업 완료 시 task 상태를 반드시 completed로 업데이트할 것
- 막히면 30분 이상 끌지 말고 리드에게 blocker 보고
- DB 모델을 변경할 경우 무조건 db:build, db:generate, db:push 실행
