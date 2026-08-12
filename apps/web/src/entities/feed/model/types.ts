import type { FeedPostDetail, MyFeedPost } from "@pawlog/shared";

export type { FeedPostDetail, MyFeedPost };

/**
 * 업로드 화면이 들고 있는 사진 한 장의 상태.
 * 방금 고른 사진은 blob 미리보기를 갖고, 업로드가 끝나면 fileId 가 채워진다.
 */
export interface ComposerPhoto {
  /** 화면에서 사진을 구분하는 로컬 키 (업로드 전에도 필요하다) */
  key: string;
  fileId: string | null;
  previewUrl: string;
  name: string;
  /** 이 **사진 한 장**에 찍힌 아이들. 팬아웃 단위가 게시물이 아니라 사진이라 여기에 있다. */
  petIds: string[];
}

/** 태그 후보 한 마리의 화면 상태 — 선택 여부와 AI 제안 여부를 함께 들고 있다. */
export interface ComposerTag {
  petId: string;
  petName: string;
  profileImageFileId: string | null;
  photoConsent: string;
  /** AI 가 제안한 아이인지 (사람이 직접 고른 것과 구분해 학습 데이터로 남긴다) */
  suggested: boolean;
  confidence: number | null;
  selected: boolean;
}
