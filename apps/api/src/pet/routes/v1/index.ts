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
} as const;
