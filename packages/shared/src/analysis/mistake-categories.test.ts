import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MISTAKE_CATEGORY_CODES,
  MistakeCategoryCodeSchema,
} from '../index.js';

describe('shared schemas', () => {
  it('[TC-00-04] MistakeCategoryCodeSchema matches the INSERT in migration 0002', () => {
    const sql = readFileSync(
      new URL(
        '../../../../db/migrations/0002_mvp_adjustments.sql',
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
