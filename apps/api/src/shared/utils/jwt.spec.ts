import jwt from "jsonwebtoken";

import {
  generateAccessToken,
  generateRefreshToken,
  generateSignUpToken,
  verifySignUpToken,
} from "./jwt";
import * as CONST from "../constants";

interface Decoded {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

describe("jwt utils", () => {
  const payload = { userId: "u1", email: "user@example.com", role: "USER" };

  it("access token: sign→verify 왕복이 payload 를 보존", () => {
    const token = generateAccessToken(payload);
    const decoded = jwt.verify(
      token,
      CONST.ACCESS_TOKEN_SECRET,
    ) as unknown as Decoded;

    expect(decoded.userId).toBe("u1");
    expect(decoded.email).toBe("user@example.com");
    expect(decoded.role).toBe("USER");
  });

  it("access token 은 refresh 시크릿으로 검증되지 않는다 (시크릿 분리)", () => {
    const token = generateAccessToken(payload);
    expect(() => jwt.verify(token, CONST.REFRESH_TOKEN_SECRET)).toThrow();
  });

  it("refresh token 도 왕복이 동작한다", () => {
    const token = generateRefreshToken(payload);
    const decoded = jwt.verify(
      token,
      CONST.REFRESH_TOKEN_SECRET,
    ) as unknown as Decoded;

    expect(decoded.userId).toBe("u1");
  });

  it("만료 시간(exp)이 발급 시간(iat)보다 뒤에 설정된다", () => {
    const token = generateAccessToken(payload);
    const decoded = jwt.decode(token) as unknown as Decoded;

    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it("verifySignUpToken 이 signup 토큰을 디코드한다", () => {
    const token = generateSignUpToken(payload);
    const decoded = verifySignUpToken(token) as unknown as Decoded;

    expect(decoded.userId).toBe("u1");
    expect(decoded.email).toBe("user@example.com");
  });
});
