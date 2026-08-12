/**
 * 원생 등록 단일 진입점 상수 (job-040).
 *
 * 런타임 값이므로 `types/contracts/` 가 아니라 여기에 둔다 — contracts 는 타입 전용으로
 * 컴파일 시 통째로 지워지고, 거기 선언한 const 는 조용히 사라진다.
 */

/** 전화번호로 조회한 보호자의 상태. 원장이 다음에 뭘 할 수 있는지가 여기서 갈린다. */
export const PET_INTAKE_GUARDIAN_STATUS = {
  /** 회원이고 우리 매장 구성원 — 이미 등록한 아이를 골라 원생으로 받을 수 있다. */
  MEMBER_OF_TENANT: "MEMBER_OF_TENANT",
  /**
   * 회원이지만 우리 매장 구성원이 아님 — **아이 목록을 내려주지 않는다.**
   * 전화번호만 넣으면 아무나 남의 아이 이름을 조회할 수 있게 되기 때문이다.
   * 새 아이를 등록하면 그 시점에 멤버십이 만들어지고, 그 뒤부터 목록이 보인다.
   */
  MEMBER_ELSEWHERE: "MEMBER_ELSEWHERE",
  /** 아직 가입하지 않음 — 계정 없이 원생으로 등록하고 초대장을 남긴다. */
  NOT_REGISTERED: "NOT_REGISTERED",
} as const;

export type PetIntakeGuardianStatus =
  (typeof PET_INTAKE_GUARDIAN_STATUS)[keyof typeof PET_INTAKE_GUARDIAN_STATUS];

/** 등록 결과. 원장에게 보여줄 안내 문구가 이 값에 따라 달라진다. */
export const PET_INTAKE_MODE = {
  /** 보호자가 이미 등록해 둔 아이를 우리 매장 원생으로 받았다. */
  ENROLLED_EXISTING: "ENROLLED_EXISTING",
  /** 가입한 보호자의 아이를 새로 만들었다(계정 연결 완료). */
  CREATED_FOR_MEMBER: "CREATED_FOR_MEMBER",
  /** 미가입 보호자의 아이를 만들었다. 계정은 아직 없고 초대장이 함께 남는다. */
  CREATED_FOR_UNREGISTERED: "CREATED_FOR_UNREGISTERED",
} as const;

export type PetIntakeMode =
  (typeof PET_INTAKE_MODE)[keyof typeof PET_INTAKE_MODE];
