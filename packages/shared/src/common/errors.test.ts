import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema } from '../index.js';

describe('errors', () => {
  it('[TC-00-04] ErrorResponseSchema accepts { error: { code, message } }', () => {
    const value = { error: { code: 'NOT_FOUND', message: 'Cannot GET /x' } };
    expect(ErrorResponseSchema.parse(value)).toEqual(value);
  });

  it('[TC-00-04] ErrorResponseSchema rejects a response without error.code', () => {
    expect(
      ErrorResponseSchema.safeParse({ error: { message: 'x' } }).success,
    ).toBe(false);
    expect(ErrorResponseSchema.safeParse({ message: 'x' }).success).toBe(false);
  });
});
