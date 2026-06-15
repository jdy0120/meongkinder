import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

import { HttpError } from "../errors/http-error";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
        };
        const responseMessage = responseObj.message ?? exception.message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(", ")
          : responseMessage;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof HttpError) {
      statusCode = exception.statusCode;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(statusCode).json({
      result: false,
      message,
      data: {
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
