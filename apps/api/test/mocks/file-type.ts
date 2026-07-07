/**
 * e2e 스텁 — `file-type` 는 순수 ESM 이라 jest(CJS) 변환 대상에서 제외되어
 * "Cannot use import statement outside a module" 를 유발한다. 파일 타입 감지는
 * e2e 대상이 아니므로 no-op 으로 대체한다. (jest-e2e.json moduleNameMapper 로 연결)
 */
export const fileTypeFromBuffer = (): Promise<undefined> =>
  Promise.resolve(undefined);
export const fileTypeFromFile = (): Promise<undefined> =>
  Promise.resolve(undefined);
