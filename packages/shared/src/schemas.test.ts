import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ErrorResponseSchema,
  HealthResponseSchema,
  MISTAKE_CATEGORY_CODES,
  MistakeCategoryCodeSchema,
} from './index.js';

describe('shared schemas', () => {
  it('[TC-00-04] ErrorResponseSchema приймає { error: { code, message } }', () => {
    const value = { error: { code: 'NOT_FOUND', message: 'Cannot GET /x' } };
    expect(ErrorResponseSchema.parse(value)).toEqual(value);
  });

  it('[TC-00-04] ErrorResponseSchema відхиляє відповідь без error.code', () => {
    expect(
      ErrorResponseSchema.safeParse({ error: { message: 'x' } }).success,
    ).toBe(false);
    expect(ErrorResponseSchema.safeParse({ message: 'x' }).success).toBe(false);
  });

  it('[TC-00-04] HealthResponseSchema приймає ok/ok і відхиляє інші значення', () => {
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

  it('[TC-00-04] MistakeCategoryCodeSchema збігається з INSERT у міграції 0002', () => {
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

  it('[TC-00-04] MistakeCategoryCodeSchema відхиляє невідомий код', () => {
    expect(MistakeCategoryCodeSchema.safeParse('spelling').success).toBe(false);
  });
});
