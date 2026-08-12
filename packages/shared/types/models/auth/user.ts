import { Prisma, User, UserInfo as UserInfoModel } from "@pawlog/database";
import { AsCreateRequest, AsUpdateRequest } from "../";

// API 응답에 절대 포함되면 안 되는 bcrypt 해시(password)를 제거한 User.
// 인증/어드민 응답 계약(SignupResponse, LoginResponse, UpdateUserResponse 등)은
// 원본 User 대신 이 타입을 사용한다.
export type SafeUser = Omit<User, "password">;

// 1. validator 대신 satisfies를 사용하여 안전하게 객체를 정의합니다.
const userProfileInclude = {
  include: {
    userInfo: true,
    socialAccounts: true,
  },
} satisfies Prisma.UserDefaultArgs;

// 2. 그 객체의 형태(typeof)를 Payload에 넘겨줍니다.
export type UserWithProfile = Prisma.UserGetPayload<typeof userProfileInclude>;

export type UserInfo = UserInfoModel;
export type UserInfoCreateInput = AsCreateRequest<UserInfo>;
export type UserInfoUpdateInput = AsUpdateRequest<UserInfo>;
