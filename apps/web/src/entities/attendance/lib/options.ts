/** 출석 상태 코드 ↔ 라벨 (표시 및 결석/보강 처리 폼 선택지에 공용) */
export const ATTENDANCE_STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "등원 예정" },
  { value: "CHECKED_IN", label: "등원" },
  { value: "CHECKED_OUT", label: "하원" },
  { value: "ABSENT", label: "결석" },
  { value: "MAKEUP", label: "보강" },
  { value: "CANCELED", label: "취소" },
] as const;

export const attendanceStatusLabelMap: Record<string, string> =
  Object.fromEntries(
    ATTENDANCE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
  );

/** 결석/보강 처리 폼에서 선택 가능한 상태 (attendance.service.ts 의 ALLOWED_STATUS_TRANSITIONS 와 동일) */
export const ATTENDANCE_STATUS_UPDATE_OPTIONS = [
  { value: "ABSENT", label: "결석" },
  { value: "MAKEUP", label: "보강" },
  { value: "CANCELED", label: "취소" },
] as const;

const formatTime = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export { formatTime };
