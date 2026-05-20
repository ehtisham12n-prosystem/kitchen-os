import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { StructuredLoggerService } from '../services/structured-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<any>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const { message, details, code } = this.normalizeErrorPayload(
      exception,
      exceptionResponse,
      statusCode,
    );
    const requestId = request?.requestId || null;

    const logPayload = {
      request_id: requestId,
      method: request?.method,
      path: request?.originalUrl || request?.url,
      status_code: statusCode,
      client_id: request?.user?.client_id || null,
      branch_id: request?.activeBranchId ?? request?.user?.branch_id ?? null,
      actor_id: request?.user?.sub ?? null,
      error_code: code,
      error_message: message,
      error_details: details,
      stack:
        statusCode >= 500 && exception instanceof Error ? exception.stack : undefined,
    };

    if (statusCode >= 500) {
      this.logger.error('HTTP request failed', logPayload);
    } else {
      this.logger.warn('HTTP request failed', logPayload);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request?.originalUrl || request?.url || null,
      request_id: requestId,
      error: {
        code,
        message,
        details,
      },
    });
  }

  private normalizeErrorPayload(
    exception: unknown,
    exceptionResponse: string | object | null,
    statusCode: number,
  ) {
    if (statusCode >= 500 && !(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected operational error occurred.',
        details: undefined as string[] | undefined,
      };
    }

    if (typeof exceptionResponse === 'string') {
      return {
        code: this.defaultCode(statusCode),
        message: exceptionResponse,
        details: undefined as string[] | undefined,
      };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as Record<string, unknown>;
      const rawMessage = responseObject.message;
      const details = Array.isArray(rawMessage)
        ? rawMessage.map((item) => String(item))
        : undefined;
      return {
        code: String(responseObject.error || this.defaultCode(statusCode)),
        message: Array.isArray(rawMessage)
          ? details?.[0] || 'Request validation failed.'
          : String(rawMessage || 'Request failed.'),
        details,
      };
    }

    if (exception instanceof Error) {
      return {
        code: this.defaultCode(statusCode),
        message: exception.message,
        details: undefined as string[] | undefined,
      };
    }

    return {
      code: this.defaultCode(statusCode),
      message: 'Request failed.',
      details: undefined as string[] | undefined,
    };
  }

  private defaultCode(statusCode: number) {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      default:
        return 'REQUEST_FAILED';
    }
  }
}
