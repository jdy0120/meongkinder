import * as path from "path";
import * as winston from "winston";
import "winston-daily-rotate-file";

const logDir = path.join(process.cwd(), "logs");

// 1. Colorized console format for local development
const devConsoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const pid = process.pid;
    const timestampStr =
      typeof info.timestamp === "string" ? info.timestamp : "";
    const levelStr = typeof info.level === "string" ? info.level : "";
    const contextStr =
      typeof info.context === "string" ? ` [${info.context}]` : "";
    const messageStr =
      typeof info.message === "string"
        ? info.message
        : JSON.stringify(info.message);
    const traceStr = typeof info.trace === "string" ? `\n${info.trace}` : "";

    return `[Nest] ${pid}  - ${timestampStr}   ${levelStr}${contextStr} ${messageStr}${traceStr}`;
  }),
);

// 2. JSON format for production (Console & Files)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

// Define transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format:
      process.env.NODE_ENV === "production" ? prodFormat : devConsoleFormat,
  }),
];

// If in production or file logging is explicitly enabled, write to rotating files
if (
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_FILE_LOGS === "true"
) {
  transports.push(
    // Error & Warning level logs
    new winston.transports.DailyRotateFile({
      level: "warn",
      dirname: logDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: prodFormat,
    }),
    // Combined logs (info level and above)
    new winston.transports.DailyRotateFile({
      level: "info",
      dirname: logDir,
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: prodFormat,
    }),
  );
}

export const winstonLoggerOptions = {
  transports,
};
