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
