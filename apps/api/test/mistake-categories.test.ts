import { MISTAKE_CATEGORY_CODES } from '@gototalk/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { FAKE_ANALYSIS_RULES } from '../src/integrations/language-model/fake-analysis-rules.js';

describe('mistake_categories', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
  });

  afterAll(async () => {
    await pool.end();
  });

  const loadCodes = async (): Promise<Set<string>> => {
    const { rows } = await pool.query<{ code: string }>(
      'SELECT code FROM mistake_categories',
    );
    return new Set(rows.map((row) => row.code));
  };

  it('[TC-04-01] the table codes equal MISTAKE_CATEGORY_CODES', async () => {
    expect(await loadCodes()).toEqual(new Set(MISTAKE_CATEGORY_CODES));
  });

  it('[TC-04-01] every category produced by the Fake analysis rules exists in the table', async () => {
    const codes = await loadCodes();
    const used = new Set(FAKE_ANALYSIS_RULES.map((rule) => rule.category));

    expect(used.size).toBeGreaterThan(0);
    for (const category of used) {
      expect(codes.has(category)).toBe(true);
    }
  });
});
