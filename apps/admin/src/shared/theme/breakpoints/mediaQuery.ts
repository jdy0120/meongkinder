/**
 * Tailwind CSS용 브레이크포인트 유틸리티
 * @param {string} classNames - 적용할 Tailwind 클래스 (예: 'bg-blue-500 p-4')
 * @param {number} breakpoint - 최소 너비(px)
 * @returns {string} Tailwind 미디어 쿼리 클래스 문자열
 */
const setBreakpointStyle =
  (classNames: string) =>
  (breakpoint: number): string => {
    // 클래스가 여러 개일 경우 각각에 프리픽스를 붙여줘야 정확히 작동합니다.
    return classNames
      .split(" ")
      .filter(Boolean)
      .map((cls) => `min-[${breakpoint}px]:${cls}`)
      .join(" ");
  };

export { setBreakpointStyle };
