/**
 * e2e 스텁 — `sharp` 는 플랫폼별 네이티브 바이너리(@img/sharp-linux-*)를 받아야 하는
 * 패키지라, 설치가 한 번 어긋난 환경에서는 `AppModule` 을 import 하는 것만으로
 * "Cannot find module 'sharp'" 가 나며 **e2e 스위트 전체가 한 줄도 못 돈다**
 * (`shared/utils/file.ts` → `file.service.ts` → `file.module.ts` → `app.module.ts`).
 *
 * 이미지 변환은 어느 e2e 스펙의 대상도 아니므로 `file-type` 과 같은 방식으로 대체한다
 * (jest-e2e.json 의 moduleNameMapper 로 연결).
 *
 * ⚠️ **성공이 아니라 실패로 흉내낸다.** `normalizeUploadedFile` 은 sharp 가 던지면 원본을
 * 그대로 두고 `converted: false` 로 넘어가도록 되어 있다(변환은 최적화일 뿐이라 실패가
 * 업로드를 막으면 안 된다). 성공을 흉내내면 `.webp` 파일이 실제로 생기지 않은 채 코드가
 * 생겼다고 믿어 뒤에서 `statSync` 가 터진다 — 없는 기능을 있는 척하는 목이 더 나쁘다.
 * 지금 형태에서 e2e 는 **폴백 경로**를 정확히 밟는다.
 */
const sharp = () => {
  throw new Error(
    "[e2e] sharp 는 스텁입니다 — 이미지 변환은 e2e 대상이 아닙니다.",
  );
};

export default sharp;
