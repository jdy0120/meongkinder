export const PET_ROUTES = {
  BASE: "v1/pets",
  LIST: "", // GET: 내 반려동물 목록
  CREATE: "", // POST: 반려동물 등록
  GET: ":id", // GET: 상세 조회
  UPDATE: ":id", // PATCH: 정보 수정
  DELETE: ":id", // DELETE: 삭제

  // job-033: 펫은 회원 소유이고 매장 소속은 별개의 조작이다.
  ENROLL: ":id/enroll", // POST: 소속된 매장에 원생으로 등록
  UNENROLL: ":id/unenroll", // POST: 등원 해지 (개인 펫으로 복귀)

  // ── 등원 예약 (job-060) — 보호자가 매장 운영일 중에서 직접 고른다 ────
  // 저장은 `PetSchedule`(source = GUARDIAN)에 한다. 원장용 스케줄 편집
  // (`PUT v1/admin/pets/:id/schedule`)과 같은 테이블이고 권한만 다르다.
  RESERVATIONS: ":id/reservations", // GET: 그 달의 예약 달력 · POST: 예약 추가
  CANCEL_RESERVATION: ":id/reservations/:date", // DELETE: 예약 1건 취소
} as const;
