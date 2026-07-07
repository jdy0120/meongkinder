/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Injectable, LoggerService } from "@nestjs/common";
import * as winston from "winston";
import { winstonLoggerOptions } from "../configs";

@Injectable()
export class WinstonLogger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger(winstonLoggerOptions);
  }

  log(message: any, ...optionalParams: any[]) {
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    this.logger.info(message, { context });
  }

  error(message: any, ...optionalParams: any[]) {
    const trace = optionalParams[0];
    const context = optionalParams[1] || optionalParams[0];
    const actualTrace =
      typeof trace === "string" && trace.includes("\n") ? trace : undefined;
    this.logger.error(message, { trace: actualTrace, context });
  }

  warn(message: any, ...optionalParams: any[]) {
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    this.logger.warn(message, { context });
  }

  debug(message: any, ...optionalParams: any[]) {
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    this.logger.debug(message, { context });
  }

  verbose(message: any, ...optionalParams: any[]) {
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    this.logger.verbose(message, { context });
  }

  fatal(message: any, ...optionalParams: any[]) {
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    this.logger.error(message, { context, fatal: true });
  }
}
