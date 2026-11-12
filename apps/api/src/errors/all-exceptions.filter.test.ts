import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost, LoggerService } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ErrorResponseSchema } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { codeFromStatus } from './error-code.js';

function setup() {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: {
      reply,
      getRequestMethod: () => 'POST',
      getRequestUrl: () => '/api/things',
    },
  } as unknown as HttpAdapterHost;
  const logger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as LoggerService;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({ marker: 'response' }),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(adapterHost, logger);

  function run(exception: unknown): { status: number; body: unknown } {
    filter.catch(exception, host);
    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0] as [unknown, unknown, number];
    return { status, body };
  }

  return { run, logger, reply };
}

describe('AllExceptionsFilter', () => {
  it('[TC-00-07] HttpException: code from status, message from the exception', () => {
    const { run, logger } = setup();

    const { status, body } = run(new NotFoundException('Cannot GET /api/nope'));

    expect(status).toBe(404);
    expect(ErrorResponseSchema.parse(body)).toEqual({
      error: { code: 'NOT_FOUND', message: 'Cannot GET /api/nope' },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('[TC-00-07] HttpException: an array of messages is joined', () => {
    const { run } = setup();

    const { body } = run(
      new BadRequestException(['name must be a string', 'age is required']),
    );

    expect(ErrorResponseSchema.parse(body)).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'name must be a string; age is required',
      },
    });
  });

  it('[TC-00-07] HttpException: string response body', () => {
    const { run } = setup();

    const { status, body } = run(new HttpException('Nope', 409));

    expect(status).toBe(409);
    expect(ErrorResponseSchema.parse(body).error).toEqual({
      code: 'CONFLICT',
      message: 'Nope',
    });
  });

  it('[TC-00-07] ZodError: 400 VALIDATION_ERROR listing fields without the submitted values', () => {
    const { run, logger } = setup();
    const schema = z.object({
      title: z.string().regex(/^d+$/),
      count: z.number().int(),
    });
    const parsed = schema.safeParse({
      title: 'SECRET-VALUE-xyz',
      count: 'SECRET-VALUE-xyz',
    });
    if (parsed.success) throw new Error('expected a validation error');

    const { status, body } = run(parsed.error);

    expect(status).toBe(400);
    const { error } = ErrorResponseSchema.parse(body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe(
      'Validation failed: title: invalid_format; count: invalid_type',
    );
    expect(JSON.stringify(body)).not.toContain('SECRET-VALUE-xyz');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('[TC-00-07] ZodError at the root is reported as (root)', () => {
    const { run } = setup();
    const parsed = z.string().safeParse(42);
    if (parsed.success) throw new Error('expected a validation error');

    const { body } = run(parsed.error);

    expect(ErrorResponseSchema.parse(body).error.message).toContain('(root)');
  });

  it('[TC-00-07] unknown error: 500 INTERNAL_ERROR without details, stack in the log', () => {
    const { run, logger } = setup();
    const failure = new Error(
      'connection to db-host:5432 refused, password=hunter2',
    );

    const { status, body } = run(failure);

    expect(status).toBe(500);
    const parsed = ErrorResponseSchema.parse(body);
    expect(parsed.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('db-host');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect((logger.error as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      expect.objectContaining({ err: failure }),
      'Unhandled exception',
      'AllExceptionsFilter',
    ]);
  });

  it('[TC-00-07] non-Error values (string, null) also give 500 INTERNAL_ERROR', () => {
    for (const thrown of ['boom', null, undefined, { secret: 1 }]) {
      const { run, logger } = setup();
      const { status, body } = run(thrown);
      expect(status).toBe(500);
      expect(ErrorResponseSchema.parse(body).error.code).toBe('INTERNAL_ERROR');
      expect(logger.error).toHaveBeenCalledTimes(1);
    }
  });

  it('[TC-00-07] 5xx HttpException: code from status, no exception details in the response, details in the log', () => {
    const { run, logger } = setup();

    const { status, body } = run(
      new ServiceUnavailableException('pg pool exhausted: host=10.0.0.5'),
    );

    expect(status).toBe(503);
    const parsed = ErrorResponseSchema.parse(body);
    expect(parsed.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('[TC-00-07] HttpException with status 500 gives INTERNAL_ERROR', () => {
    const { run } = setup();

    const { status, body } = run(new HttpException('details', 500));

    expect(status).toBe(500);
    expect(ErrorResponseSchema.parse(body).error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('details');
  });

  it('[TC-00-07] HttpException with a string code in the body: the code replaces the status-derived one', () => {
    const { run } = setup();

    const { status, body } = run(
      new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email is taken' }),
    );

    expect(status).toBe(409);
    expect(ErrorResponseSchema.parse(body).error).toEqual({
      code: 'EMAIL_TAKEN',
      message: 'Email is taken',
    });
  });

  it('[TC-00-07] HttpException with a non-string code in the body falls back to the status code', () => {
    const { run } = setup();

    const { body } = run(new ConflictException({ code: 42, message: 'x' }));

    expect(ErrorResponseSchema.parse(body).error.code).toBe('CONFLICT');
  });

  it('[TC-00-07] 5xx HttpException with a custom code: code derived from status, message sanitised', () => {
    const { run, logger } = setup();

    const { status, body } = run(
      new ServiceUnavailableException({
        code: '57P01',
        message: 'pg pool exhausted: host=10.0.0.5',
      }),
    );

    expect(status).toBe(503);
    expect(ErrorResponseSchema.parse(body).error).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service Unavailable',
    });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('[TC-00-07] body parser error (http-errors, 4xx) becomes a response built from the status code', () => {
    const { run } = setup();
    const parserError = Object.assign(
      new SyntaxError('Unexpected token } in JSON'),
      {
        statusCode: 400,
        status: 400,
        type: 'entity.parse.failed',
      },
    );

    const { status, body } = run(parserError);

    expect(status).toBe(400);
    const parsed = ErrorResponseSchema.parse(body);
    expect(parsed.error.code).toBe('BAD_REQUEST');
    expect(parsed.error.message).not.toContain('Unexpected token');
  });
});

describe('codeFromStatus', () => {
  it('[TC-00-07] stable map of known statuses', () => {
    expect(codeFromStatus(400)).toBe('BAD_REQUEST');
    expect(codeFromStatus(401)).toBe('UNAUTHORIZED');
    expect(codeFromStatus(403)).toBe('FORBIDDEN');
    expect(codeFromStatus(404)).toBe('NOT_FOUND');
    expect(codeFromStatus(409)).toBe('CONFLICT');
    expect(codeFromStatus(422)).toBe('UNPROCESSABLE_ENTITY');
    expect(codeFromStatus(429)).toBe('TOO_MANY_REQUESTS');
    expect(codeFromStatus(500)).toBe('INTERNAL_ERROR');
  });

  it('[TC-00-07] other statuses: standard name in UPPER_SNAKE_CASE', () => {
    expect(codeFromStatus(405)).toBe('METHOD_NOT_ALLOWED');
    expect(codeFromStatus(503)).toBe('SERVICE_UNAVAILABLE');
    expect(codeFromStatus(418)).toBe('IM_A_TEAPOT');
  });

  it('[TC-00-07] unknown status: fallback code by class', () => {
    expect(codeFromStatus(499)).toBe('CLIENT_ERROR');
    expect(codeFromStatus(599)).toBe('INTERNAL_ERROR');
  });

  it('[TC-00-07] ConflictException gives CONFLICT through the filter', () => {
    const { run } = setup();
    const { status, body } = run(new ConflictException('exists'));
    expect(status).toBe(409);
    expect(ErrorResponseSchema.parse(body).error.code).toBe('CONFLICT');
  });
});
