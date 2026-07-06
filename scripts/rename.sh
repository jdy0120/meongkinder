#!/usr/bin/env bash
#
# 템플릿의 "template" 네이밍을 실제 프로젝트 이름으로 일괄 치환합니다.
#
# 바뀌는 것:
#   1) npm 스코프         @template/*        -> @<scope>/*        (packages 3개 + 모든 import)
#   2) 루트 패키지 name    "name": "template" -> "name": "<name>"  (루트 package.json)
#   3) PROJECT_NAME       template[-prod|-dev] -> <name>[-prod|-dev]  (envs/.env*)
#
# 사용법:
#   ./scripts/rename.sh <new-name> [scope]
#     <new-name>  루트 패키지명 / PROJECT_NAME 에 쓸 이름 (예: myapp)
#     [scope]     npm 스코프 (생략 시 <new-name> 사용) -> @<scope>/
#
# 예:
#   ./scripts/rename.sh myapp            # @myapp/*, name "myapp", PROJECT_NAME myapp*
#   ./scripts/rename.sh myapp acme       # @acme/* 로, 나머지는 myapp
#
# 실행 후 반드시:  pnpm install   (락파일 재생성)
#
set -euo pipefail

OLD_SCOPE="template"
OLD_NAME="template"

if [ $# -lt 1 ]; then
  echo "사용법: $0 <new-name> [scope]" >&2
  exit 1
fi

NEW_NAME="$1"
NEW_SCOPE="${2:-$1}"

# 프로젝트 루트로 이동 (스크립트 위치 기준)
cd "$(dirname "$0")/.."

# git 작업 트리가 지저분하면 경고 (되돌리기 쉽도록 커밋/스태시 권장)
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  커밋되지 않은 변경사항이 있습니다. 문제가 생기면 'git checkout .' 로 되돌리세요." >&2
  fi
fi

# BSD(macOS) / GNU(Linux) sed 호환 in-place 치환
sed_i() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"       # GNU
  else
    sed -i '' "$@"    # BSD
  fi
}

echo "▶ 스코프 치환: @${OLD_SCOPE}/  ->  @${NEW_SCOPE}/"
# @template/ 처럼 슬래시까지 붙여 정확히 스코프만 치환 (오탐 방지)
# scripts 디렉터리는 자기 자신을 고치지 않도록 제외
grep -rl "@${OLD_SCOPE}/" . \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  --exclude-dir=.git --exclude-dir=.turbo --exclude-dir=generated \
  --exclude-dir=scripts \
  --exclude=pnpm-lock.yaml \
  2>/dev/null \
| while IFS= read -r f; do
    sed_i "s|@${OLD_SCOPE}/|@${NEW_SCOPE}/|g" "$f"
    echo "   - $f"
  done

echo "▶ 루트 package.json name: \"${OLD_NAME}\" -> \"${NEW_NAME}\""
sed_i "s|\"name\": \"${OLD_NAME}\"|\"name\": \"${NEW_NAME}\"|" ./package.json

echo "▶ PROJECT_NAME 치환 (envs/.env*, 접미사 유지)"
for envf in envs/.env envs/.env.dev envs/.env.prod; do
  if [ -f "$envf" ]; then
    # PROJECT_NAME=template / template-prod / template-dev  모두 커버
    sed_i "s|PROJECT_NAME=${OLD_NAME}|PROJECT_NAME=${NEW_NAME}|" "$envf"
    echo "   - $envf"
  fi
done

echo
echo "✅ 완료. 남은 단계:"
echo "   1) pnpm install        # 락파일(@${NEW_SCOPE}/*) 재생성"
echo "   2) git diff 로 확인 후 커밋"
echo "   (README 등 문서의 예시 텍스트는 필요 시 수동으로 확인하세요)"
