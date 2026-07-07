import { Logger } from "@nestjs/common";

export * from "./logger.module";
export * from "./logger.service";

export const fileLogger = new Logger("FileUtils");
export const dbLogger = new Logger("Database");
export const bootstrapLogger = new Logger("Bootstrap");
export const appLogger = new Logger("AppModule");

export const createLogger = (context: string) => new Logger(context);
