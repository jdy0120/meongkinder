export const PET_ROUTES = {
  BASE: "v1/pets",
  LIST: "", // GET: 내 반려동물 목록
  CREATE: "", // POST: 반려동물 등록
  GET: ":id", // GET: 상세 조회
  UPDATE: ":id", // PATCH: 정보 수정
  DELETE: ":id", // DELETE: 삭제
} as const;
