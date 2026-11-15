import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '../index.js';

describe('health', () => {
  it('[TC-00-04] HealthResponseSchema accepts ok/ok and rejects other values', () => {
    expect(HealthResponseSchema.parse({ status: 'ok', db: 'ok' })).toEqual({
      status: 'ok',
      db: 'ok',
    });
    expect(
      HealthResponseSchema.safeParse({ status: 'ok', db: 'down' }).success,
    ).toBe(false);
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(
      false,
    );
  });
});
