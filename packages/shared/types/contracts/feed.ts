import type { FeedMedia, FeedPost, FeedTag, Pet } from "@pawlog/database";

// ── 업로드 ────────────────────────────────────────────────────────────────
// 플로우: 사진 여러 장 선택 → v1/file/upload 로 임시 업로드 → 그 fileId 들로 태그 제안 요청
// → 사람이 원탭 수정 → 캡션(AI 초안 제공) → 게시. 게시 시점에 태그된 아이의 보호자에게 팬아웃된다.

export interface CreateFeedMediaRequest {
  fileId: string; // v1/file/upload 응답의 File.id
  type?: string; // IMAGE(기본) | VIDEO
  order?: number;
}

export interface CreateFeedTagRequest {
  petId: string;
  /**
   * 이 아이가 찍힌 **사진**. 같은 요청의 `media[].fileId` 중 하나여야 한다.
   *
   * 태그가 게시물이 아니라 사진에 붙는 것이 팬아웃의 전제다 — 게시물 단위였다면 12장을 한 번에
   * 올릴 때 12장 전부가 태그된 모든 아이에게 가고, 초코만 나온 사진이 두부 보호자에게 간다.
   */
  fileId: string;
  source?: string; // AI | MANUAL(기본)
  confidence?: number; // AI 제안일 때의 확신도 0~1
  confirmed?: boolean; // 사람이 눈으로 확인했는지
}

export interface CreateFeedPostRequest {
  date?: string; // ISO 8601. 미지정 시 오늘 (어제 사진을 오늘 올리는 경우가 있다)
  caption?: string;
  status?: string; // DRAFT(기본) | PUBLISHED
  media: CreateFeedMediaRequest[];
  tags?: CreateFeedTagRequest[];
  /**
   * 이 게시물에 대해 AI 가 제안했던 아이 전체 (사람이 최종적으로 뺀 아이 포함).
   *
   * `tags` 만으로는 "AI 가 제안했는데 사람이 거절했다"는 **거짓 양성**을 알 수 없다.
   * 정확도를 재고 모델을 고치는 데 가장 값진 신호가 바로 그 거절이라 따로 받는다.
   */
  suggestedPetIds?: string[];
}

export interface UpdateFeedPostRequest {
  date?: string;
  caption?: string;
  status?: string;
  /**
   * 전달 시 태그 전체를 대체한다. AI 제안과 달라진 부분은 FeedTagCorrection 으로 기록되어
   * 학습 데이터가 되므로, 부분 수정이 아니라 최종 명단을 그대로 보낸다.
   */
  tags?: CreateFeedTagRequest[];
}

// ── AI 태그 제안 ──────────────────────────────────────────────────────────

export interface SuggestFeedTagsRequest {
  fileIds: string[]; // 방금 업로드한 사진들
  date?: string; // 후보를 좁힐 기준 일자 (미지정 시 오늘)
}

export interface FeedTagSuggestion {
  petId: string;
  petName: string;
  profileImageFileId: string | null;
  confidence: number; // 0~1
  /** 확신도가 임계값 미만이라 "이 아이 맞나요?" 확인이 필요한지 */
  needsConfirmation: boolean;
  /** 초상권 동의 범위 — PRIVATE 인 아이는 태그 화면에서 회색 처리된다 */
  photoConsent: string;
}

export interface SuggestFeedTagsResponse {
  suggestions: FeedTagSuggestion[];
  /** 제안의 모집단(오늘 등원한 아이). 사람이 직접 고를 때의 선택지이기도 하다. */
  candidates: FeedTagSuggestion[];
}

// ── 조회 ──────────────────────────────────────────────────────────────────

export interface FeedTagWithPet extends FeedTag {
  pet: {
    id: string;
    name: string;
    profileImageFileId: string | null;
    photoConsent: string;
  };
}

export interface FeedMediaWithFile extends FeedMedia {
  file: { id: string; originalName: string; mimeType: string };
  /** 이 사진에 찍힌 아이들 */
  tags: FeedTagWithPet[];
}

export interface FeedPostDetail extends FeedPost {
  media: FeedMediaWithFile[];
  /** 게시물 전체에 등장한 아이(사진별 태그를 합친 것). 카드 상단 칩 등 요약 표시에 쓴다. */
  tags: FeedTagWithPet[];
  author: { id: string; nickname: string } | null;
}

export interface FeedPostResponse {
  feedPost: FeedPostDetail;
}

// ── 오늘 사진 0장 알림 (원장 화면) ────────────────────────────────────────
// 폼 방식은 20마리를 순서대로 쓰니 누락이 구조적으로 없다. 피드는 안 찍히면 그냥 빠지므로
// 시스템이 대신 세어 줘야 한다. 이 화면이 없으면 "우리 애만 사진이 없다"는 클레임이 터진다.

export interface FeedCoveragePet {
  petId: string;
  petName: string;
  profileImageFileId: string | null;
  photoCount: number;
}

export interface FeedCoverageResponse {
  date: string; // ISO 8601 (YYYY-MM-DD)
  /** 오늘 등원했는데 사진이 한 장도 없는 아이 */
  missing: FeedCoveragePet[];
  /** 사진이 한 장 이상 있는 아이 */
  covered: FeedCoveragePet[];
  totalPets: number;
  postCount: number;
}

// ── 하루 마감 (아이별 요약 → 일일 리포트 자동 생성) ────────────────────────
// "선생님은 알림장을 한 번도 쓰지 않습니다"가 성립하는 지점.

export interface RunFeedDigestRequest {
  date?: string; // ISO 8601. 미지정 시 오늘
  /** true 면 생성된 리포트를 곧바로 PUBLISHED 로 발행한다 (기본 false — 검수 후 발행) */
  publish?: boolean;
}

/**
 * 재마감(같은 날 두 번째 실행)에서 그 아이에게 실제로 일어난 일.
 *   CREATED    새로 만들었다
 *   UPDATED    피드가 만들었던 리포트를 최신 사진으로 다시 채웠다
 *   DRAFT_ONLY 선생님이 직접 쓴 리포트라 AI 초안만 갱신하고 사진·총평은 그대로 뒀다
 */
export type FeedDigestAction = "CREATED" | "UPDATED" | "DRAFT_ONLY";

export interface FeedDigestResult {
  petId: string;
  petName: string;
  dailyReportId: string;
  photoCount: number;
  summary: string;
  action: FeedDigestAction;
}

export interface RunFeedDigestResponse {
  date: string;
  results: FeedDigestResult[];
}

// ── 보호자 피드 ───────────────────────────────────────────────────────────
// 기본 화면은 "우리 아이가 태그된 것만"이다. 전체 원 피드를 기본으로 두면 보호자가
// 장수를 세기 시작하고("우리 애 3장 / 옆집 애 12장"), 그 클레임이 곧 해지 사유가 된다.

export interface MyFeedQuery {
  petId?: string;
  date?: string;
}

/** 게시물 + "이 게시물에서 내 아이가 누구인지" — 같은 사진이 여러 보호자에게 각자의 사진이 된다. */
export interface MyFeedPost extends FeedPostDetail {
  myPets: Pick<Pet, "id" | "name" | "profileImageFileId">[];
}
