import { HttpError } from "./http-error";

export class TokenError extends HttpError {
  constructor(
    statusCode: number,
    readonly isAccessTokenExpired: boolean,
    readonly isRefreshTokenExpired: boolean,
  ) {
    super(statusCode);

    this.name = TokenError.name;
  }
}
