import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ErrorResponseSchema,
  HealthResponseSchema,
  MISTAKE_CATEGORY_CODES,
  MistakeCategoryCodeSchema,
} from './index.js';

describe('shared schemas', () => {
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

  it('[TC-00-04] MistakeCategoryCodeSchema matches the INSERT in migration 0002', () => {
    const sql = readFileSync(
      new URL(
        '../../../db/migrations/0002_mvp_adjustments.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const insert = /INSERT INTO mistake_categories[^;]*;/.exec(sql)?.[0] ?? '';
    const codes = [...insert.matchAll(/^\s*\('([a-z_0-9]+)'/gm)].map(
      (m) => m[1],
    );
    expect(codes).toHaveLength(13);
    expect([...MISTAKE_CATEGORY_CODES]).toEqual(codes);
    expect(MistakeCategoryCodeSchema.options).toEqual(codes);
  });

  it('[TC-00-04] MistakeCategoryCodeSchema rejects an unknown code', () => {
    expect(MistakeCategoryCodeSchema.safeParse('spelling').success).toBe(false);
  });
});
