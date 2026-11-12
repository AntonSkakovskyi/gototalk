import { STATUS_CODES } from 'node:http';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  LoggerService,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { ErrorResponse } from '@gototalk/shared';
import { ZodError } from 'zod';
import { codeFromStatus } from './error-code.js';

const GENERIC_SERVER_MESSAGE = 'Internal server error';

// body-parser and other http-errors are not HttpException but carry a 4xx statusCode
function clientErrorStatus(exception: unknown): number | undefined {
  if (!(exception instanceof Error)) return undefined;
  const status = (exception as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}

function httpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join('; ');
  if (typeof message === 'string') return message;
  return exception.message;
}

// Only field path and issue code are reported: user-supplied values never reach the response
function zodMessage(error: ZodError): string {
  const problems = error.issues.map((issue) => {
    const path =
      issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
    return `${path}: ${issue.code}`;
  });
  return `Validation failed: ${problems.join('; ')}`;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request: unknown = ctx.getRequest();

    const { status, body } = this.toResponse(exception, () => ({
      method: httpAdapter.getRequestMethod(request),
      url: httpAdapter.getRequestUrl(request),
    }));

    httpAdapter.reply(ctx.getResponse(), body, status);
  }

  private toResponse(
    exception: unknown,
    requestInfo: () => { method: string; url: string },
  ): { status: number; body: ErrorResponse } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: { code: 'VALIDATION_ERROR', message: zodMessage(exception) },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status < 500) {
        return {
          status,
          body: {
            error: {
              code: codeFromStatus(status),
              message: httpExceptionMessage(exception),
            },
          },
        };
      }
      this.logUnexpected(exception, requestInfo());
      return {
        status,
        body: {
          error: {
            code: codeFromStatus(status),
            message:
              status === 500
                ? GENERIC_SERVER_MESSAGE
                : (STATUS_CODES[status] ?? GENERIC_SERVER_MESSAGE),
          },
        },
      };
    }

    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== undefined) {
      return {
        status: clientStatus,
        body: {
          error: {
            code: codeFromStatus(clientStatus),
            message: STATUS_CODES[clientStatus] ?? 'Bad request',
          },
        },
      };
    }

    this.logUnexpected(exception, requestInfo());
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: { code: 'INTERNAL_ERROR', message: GENERIC_SERVER_MESSAGE },
      },
    };
  }

  private logUnexpected(
    exception: unknown,
    request: { method: string; url: string },
  ): void {
    // The stack goes only to the log, never to the response
    this.logger.error({ err: exception, ...request }, 'Unhandled exception');
  }
}
