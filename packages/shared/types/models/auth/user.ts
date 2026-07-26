import { Prisma, UserInfo as UserInfoModel } from "@pawlog/database";
import { AsCreateRequest, AsUpdateRequest } from "../";

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
