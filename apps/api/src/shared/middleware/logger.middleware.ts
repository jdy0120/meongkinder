import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") {
    const str = (obj as { toString(): string }).toString();
    return str.length > 1000 ? `${str.substring(0, 1000)}... (truncated)` : str;
  }

  if (Buffer.isBuffer(obj)) {
    return `[Buffer: ${obj.length} bytes]`;
  }

  if (Array.isArray(obj)) {
    const sanitized: unknown[] = [];
    const arr = obj as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const val = arr[i];
      if (typeof val === "object" && val !== null) {
        sanitized.push(sanitizeForLog(val));
      } else {
        const strVal = String(val);
        sanitized.push(
          strVal.length > 1000
            ? `${strVal.substring(0, 1000)}... (truncated)`
            : val,
        );
      }
    }
    return sanitized;
  } else {
    const sanitized: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const val = record[key];
        if (
          typeof key === "string" &&
          /password|token|secret|access_token|refresh_token/i.test(key)
        ) {
          sanitized[key] = "********";
        } else if (typeof val === "object" && val !== null) {
          sanitized[key] = sanitizeForLog(val);
        } else {
          const strVal = String(val);
          sanitized[key] =
            strVal.length > 1000
              ? `${strVal.substring(0, 1000)}... (truncated)`
              : val;
        }
      }
    }
    return sanitized;
  }
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get("user-agent") || "";
    const startTime = Date.now();

    let responseBody: unknown = null;
    const originalSend = response.send as unknown;

    response.send = function (
      this: Response,
      chunk: unknown,
      ...args: unknown[]
    ): Response {
      responseBody = chunk;
      return (originalSend as (...args: unknown[]) => Response).apply(this, [
        chunk,
        ...args,
      ]) as Response;
    };

    response.on("finish", () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;

      const reqDetails: Record<string, unknown> = {};
      if (Object.keys(request.query || {}).length > 0) {
        reqDetails.query = request.query;
      }
      if (
        Object.keys((request.body as Record<string, unknown>) || {}).length > 0
      ) {
        reqDetails.body = request.body as unknown;
      }

      const reqLog =
        Object.keys(reqDetails).length > 0
          ? `\n  Request: ${JSON.stringify(sanitizeForLog(reqDetails), null, 2)}`
          : "";

      let parsedResBody: unknown = responseBody;
      if (typeof responseBody === "string") {
        try {
          parsedResBody = JSON.parse(responseBody) as unknown;
        } catch {
          // Keep as string if it's not JSON
        }
      }

      const resLog = parsedResBody
        ? `\n  Response: ${JSON.stringify(sanitizeForLog(parsedResBody), null, 2)}`
        : "";

      const reqWithUser = request as Request & {
        user?: { userId?: string; email?: string };
      };
      const user = reqWithUser.user;
      const userInfo = user
        ? `[User: ${user.email || user.userId || ""}] `
        : "";

      const logMessage = `${userInfo}${method} ${originalUrl} ${statusCode} - ${duration}ms | ${userAgent} ${ip}${reqLog}${resLog}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
