import type { Role } from "@template/shared";

export {};

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: Role;
      refreshToken?: string;
    }
  }
}
