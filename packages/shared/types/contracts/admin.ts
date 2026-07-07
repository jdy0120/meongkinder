// 관리자 도메인 API 계약
import type {
  User,
  UserSubscription,
  SubscriptionPlan,
  UserTermsAgreement,
  Terms,
} from "@template/database";
import type { Role } from "../../src/roles";

export interface UpdateUserRoleRequest {
  role: Role;
}

export interface UpdateUserRoleResponse {
  message: string;
  user: User;
}

// 사용자 정보 수정 (닉네임·계정 상태) — ADMIN 전용. 필드는 선택적(부분 수정).
export interface UpdateUserRequest {
  nickname?: string;
  status?: string; // "ACTIVE" | "PENDING" | "SUSPENDED"
}

export interface UpdateUserResponse {
  message: string;
  user: User;
}

export interface UserSubscriptionDetail extends UserSubscription {
  user: {
    email: string;
    nickname: string;
  };
  plan: SubscriptionPlan;
}

export interface UserWithAgreements extends User {
  termsAgreements?: (UserTermsAgreement & {
    terms: Terms;
  })[];
}

export interface CreateTermsRequest {
  title: string;
  type: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  fileId?: string;
}

export interface CreateTermsResponse {
  message: string;
  terms: Terms;
}

export interface UpdateTermsActiveRequest {
  isActive: boolean;
}

export interface UpdateTermsActiveResponse {
  message: string;
  terms: Terms;
}
