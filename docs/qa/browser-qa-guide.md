# 브라우저 QA 가이드 — Claude in Chrome 페르소나 테스트

> 모든 페르소나 에이전트가 **먼저 읽는 공통 문서**. 접속 주소·계정 발급·세션 전환·
> 리포트 형식이 여기에 있다. 페르소나별 시나리오는 `.claude/agents/qa-*.md` 에 있다.

---

## 0. 왜 브라우저로 테스트하는가 — 무엇을 찾을 것인가

**API 는 이미 검증돼 있다.** 역할별 플로우 59건이 curl 로 통과했고, 권한·격리·계약은
그 층에서 잡힌다. 브라우저 에이전트가 그걸 다시 하면 **비싼 방법으로 같은 것을 확인하는
셈**이라 가치가 없다.

이 저장소에는 API 층이 구조적으로 볼 수 없는 공백이 있다. 문서(`CLAUDE.md`)가 스스로
"⚠️ 브라우저 상호작용은 검증하지 못했다 — 이 샌드박스에 headless Chromium 이 없다"고
두 번 적어 둔 자리다. **거기가 이 테스트의 표적이다.**

| 표적 | 왜 API 로 안 잡히나 |
| --- | --- |
| SSR 200 인데 화면이 비어 있음 | 렌더 중 TypeError 는 상태 코드를 바꾸지 않는다. job-044 가 실제로 이렇게 터졌다 — 원생 목록이 통째로 깨졌는데 서버 로그에 아무것도 안 남았다 |
| 뮤테이션 후 목록이 안 바뀜 | `invalidateQueries` 는 **마운트된** 쿼리만 다시 부른다. 화면을 옮기는 흐름에서만 드러난다 (job-054) |
| 되돌리기 토스트 8초 | 상태와 이용권 차감을 함께 되돌리는데, 토스트를 못 누르면 되돌릴 방법이 없다 |
| 바텀시트 드래그 / 필터 칩 가로 스크롤 | 좌표와 제스처의 문제다 |
| 터치 타겟 64px, 15px 하한 | "젖은 손·한 손·현관에서 쓴다"가 설계 제약이다. 실측만이 판정한다 |
| 이미지 404 | job-055 가 이 부류였다. 응답은 정상인데 `<img>` 만 깨진다 |
| 로딩 순서가 우선순위를 뒤집음 | 대시보드 5블록이 한 응답인 이유가 이것이다 |
| 라이트/다크 대비 | 뷰어 테마가 셋(light/dark/system)이다 |

**규칙: 화면을 눈으로 보고 판정한다.** DevTools 네트워크 탭의 200 은 근거가 아니다.
스크린샷과 "무엇이 보였는가"가 근거다.

---

## 1. 접속 주소 — localhost 를 쓰면 안 된다

| 대상 | URL |
| --- | --- |
| web (보호자 + 매장) | `https://pawlog-dev.doyeonism.com` |
| admin (플랫폼 콘솔) | `https://pawlog-dev.doyeonism.com/admin` |
| API | `https://pawlog-dev.doyeonism.com/api/pawlog-dev` |

`http://localhost:3001` 은 같은 컨테이너를 가리키지만 **로그인이 완결되지 않는다**:

- 인증 쿠키가 `Domain=.pawlog-dev.doyeonism.com` 으로 내려온다 → localhost 에는 안 붙는다
- 카카오 콜백이 `https://pawlog-dev.doyeonism.com/...` 으로 고정돼 있다 → 로컬에서 카카오
  버튼을 누르면 세션이 원격에 생기고 로컬 탭은 계속 로그아웃 상태다

localhost 는 정적 화면(랜딩·로그인 폼)을 볼 때만 쓴다.

---

## 2. 세션 전환 — 카카오 없이 로그인하는 방법

`apps/web` 의 로그인 화면에는 **카카오 버튼밖에 없다**(job-036). 하지만 이메일 로그인
API 는 살아 있고(`apps/admin` + e2e 용), 같은 도메인이므로 **같은 쿠키를 심는다.**

페르소나 전환은 브라우저에서 이 한 줄로 한다:

```js
await fetch('/api/pawlog-dev/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: '<페르소나 이메일>', password: '<비밀번호>' }),
}).then(r => r.json());
// 그 다음 반드시 페이지를 새로 로드한다 (SSR 가드가 쿠키를 읽는다)
location.href = '/launch';
```

로그아웃(다음 페르소나로 넘어가기 전 **필수**):

```js
await fetch('/api/pawlog-dev/v1/auth/logout', { method: 'POST', credentials: 'include' });
location.href = '/';
```

> ⚠️ **주의**: 이건 테스트 지그이지 제품 흐름이 아니다. "카카오 로그인이 되는가"는
> 이 방법으로 검증되지 않는다 — 그건 사람이 한 번 직접 눌러 확인해야 한다(§6).
>
> ⚠️ access token 은 30분짜리다. 세션이 길어지면 화면이 스스로 갱신하는지(=인터셉터의
> refresh 가 도는지)가 오히려 관찰 대상이다. 갑자기 로그인 화면으로 튕기면 **버그로 기록한다.**

---

## 3. 페르소나 계정 만들기 (세션 0에서 한 번)

제품의 자기 API 로 만든다. 플랫폼 콘솔의 계정 발급(`POST v1/platform/users`)은 약관 동의를
만들지 않으므로, 발급된 계정으로 web 에 처음 들어가면 **최초 진입 게이트(`/welcome`)를
그대로 지난다** — 그 자체가 테스트 항목이다.

```bash
# 1) SUPER_ADMIN 으로 로그인해 쿠키 저장
curl -s -c /tmp/qa.jar -X POST \
  https://pawlog-dev.doyeonism.com/api/pawlog-dev/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-strong-password"}'

# 2) 페르소나 계정 발급 (원장/선생님/보호자/침입자)
for p in \
  '{"email":"qa.owner@pawlog.test","password":"QaTest1234!","nickname":"박원장","phone":"01011110001"}' \
  '{"email":"qa.staff@pawlog.test","password":"QaTest1234!","nickname":"김선생","phone":"01011110002"}' \
  '{"email":"qa.guardian@pawlog.test","password":"QaTest1234!","nickname":"이보호자","phone":"01011110003"}' \
  '{"email":"qa.rival@pawlog.test","password":"QaTest1234!","nickname":"한침입자","phone":"01011110004"}' ; do
  curl -s -b /tmp/qa.jar -X POST \
    https://pawlog-dev.doyeonism.com/api/pawlog-dev/v1/platform/users \
    -H 'Content-Type: application/json' -d "$p"
  echo
done
```

**비밀번호는 전부 `QaTest1234!`**, 이메일은 `qa.*@pawlog.test` 로 통일한다 —
정리할 때 한 번에 지울 수 있어야 한다.

매장 개설권은 `ALLOW_UNPAID_TENANT_SEAT=true` (dev) 라 결제 없이 발급된다(job-056).
원장 페르소나가 화면에서 직접 받는 것이 정상 경로이고, 그 흐름 자체가 세션 1의 첫 항목이다.

---

## 4. 기존 데이터에 대해

dev DB 에는 스모크 테스트 잔여물이 많다(회원 104 · 원생 55 · 테넌트 23, 대부분
`*1785890653@test.local` 형태). **지우지 말고 무시한다** — 목록·검색·페이지네이션이
현실적인 양의 데이터에서 어떻게 보이는지가 오히려 관찰 대상이다.

새로 만드는 것에는 전부 `QA` 접두사를 붙인다(매장 `QA유치원`, 원생 `QA초코`).
그래야 나중에 골라낼 수 있다.

---

## 5. 리포트 형식

발견마다 아래 형식으로 기록한다. **"안 된다"가 아니라 "무엇을 했더니 무엇이 보였다"** 로 쓴다.

```
### [심각도] 한 줄 요약
- 페르소나: 김선생 (STAFF)
- 경로: /tenant/qa-school/attendance → 초코 카드 → 등원 체크
- 기대: 토스트에 "되돌리기"가 8초간 뜬다
- 실제: 토스트가 즉시 사라져 되돌리기를 누를 수 없었다 (스크린샷 3)
- 재현: 3/3
- 화면 밖 근거: (콘솔 에러 / 네트워크 상태코드가 있으면)
```

심각도 기준:

- **critical** — 데이터가 틀리거나(차감·잔액·매출), 남의 데이터가 보이거나, 화면이 통째로 안 뜬다
- **major** — 주요 동작이 막힌다. 우회로가 없다
- **minor** — 되긴 되는데 어긋난다(정렬·간격·문구)
- **question** — 버그인지 의도인지 모르겠다. 판단을 요청한다

**추측으로 원인을 적지 않는다.** 코드를 열어 원인을 진단하는 것은 이 에이전트의 일이 아니다.
관찰만 정확히 기록하면 된다.

---

## 6. 사람이 직접 해야 하는 것 (에이전트가 못 함)

- **카카오 로그인 실제 통과** — OAuth 동의 화면은 자동화 대상이 아니다. 최초 1회 사람이
  누르고, 그 뒤 `/welcome` 게이트가 뜨는지까지 확인한다
- **실기기 터치** — 64px 타겟, 바텀시트 드래그, 필터 칩 가로 스크롤은 데스크톱 마우스로
  판정할 수 없다. 에이전트는 크기를 **측정**만 하고, 손가락 판정은 사람 몫이다
- **카메라 입력** — 피드 업로드의 `capture` 경로
- **알림톡 실수신** — 발신프로필 심사 전이라 SMS 폴백으로만 나간다
