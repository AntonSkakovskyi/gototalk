import 'reflect-metadata';
import { ErrorResponseSchema } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestValidationError } from '../../common/pipes/zod-body.pipe.js';
import { setup } from './testing/filter-harness.js';

describe('AllExceptionsFilter', () => {
  it('[TC-00-07] RequestValidationError: 400 VALIDATION_ERROR listing fields without the submitted values', () => {
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

    const { status, body } = run(
      new RequestValidationError(parsed.error.issues),
    );

    expect(status).toBe(400);
    const { error } = ErrorResponseSchema.parse(body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe(
      'Validation failed: title: invalid_format; count: invalid_type',
    );
    expect(JSON.stringify(body)).not.toContain('SECRET-VALUE-xyz');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('[TC-00-07] RequestValidationError at the root is reported as (root)', () => {
    const { run } = setup();
    const parsed = z.string().safeParse(42);
    if (parsed.success) throw new Error('expected a validation error');

    const { body } = run(new RequestValidationError(parsed.error.issues));

    expect(ErrorResponseSchema.parse(body).error.message).toContain('(root)');
  });

  it('[TC-00-07] raw ZodError: 500 INTERNAL_ERROR without issue details in the response', () => {
    const { run } = setup();
    const parsed = z
      .object({ title: z.string().regex(/^d+$/) })
      .safeParse({ title: 'secret-user-text' });
    if (parsed.success) throw new Error('expected a validation error');

    const { status, body } = run(parsed.error);

    expect(status).toBe(500);
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  it('[TC-04-01] raw ZodError: the log keeps paths and codes but no values', () => {
    const { run, logger } = setup();
    const schema = z.object({
      category: z.enum(['grammar', 'vocabulary']),
      text: z.string().refine(() => false, {
        error: (issue) => `bad value ${String(issue.input)}`,
      }),
    });
    const parsed = schema.safeParse({
      category: 'secret-user-text',
      text: 'secret-user-text',
    });
    if (parsed.success) throw new Error('expected a validation error');
    expect(parsed.error.message).toContain('secret-user-text');

    run(parsed.error);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [payload, message, context] = (
      logger.error as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [
      { err: Error; method: string; url: string },
      string,
      string,
    ];
    expect(message).toBe('Unhandled exception');
    expect(context).toBe('AllExceptionsFilter');
    expect(payload.err).toBeInstanceOf(Error);
    expect(payload.err.name).toBe('ZodError');
    expect(payload.err.message).toBe(
      'Schema validation failed: category: invalid_value; text: custom',
    );
    const dumped = [
      JSON.stringify(payload),
      payload.err.message,
      payload.err.stack,
      ...Object.getOwnPropertyNames(payload.err).map((key) =>
        JSON.stringify(
          (payload.err as unknown as Record<string, unknown>)[key],
        ),
      ),
    ].join(' ');
    expect(dumped).not.toContain('secret-user-text');
    expect(payload.err.stack).toContain('    at ');
  });
});
