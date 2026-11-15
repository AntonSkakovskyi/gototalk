import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { resetUserData } from '../../support/test-db.js';

async function count(pool: pg.Pool, table: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) AS count FROM ${table}`,
  );
  return Number(rows[0]?.count);
}

describe('resetUserData', () => {
  let pool: pg.Pool;
  const theoryLinkId = randomUUID();

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
    await pool.query(
      `INSERT INTO theory_links (id, category, title, url)
       VALUES ($1, 'articles', 'reset-user-data probe', 'https://example.com')`,
      [theoryLinkId],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM theory_links WHERE id = $1', [theoryLinkId]);
    await pool.end();
  });

  it('[TC-00-04] removes users and their dependent rows but keeps reference tables', async () => {
    const categoriesBefore = await count(pool, 'mistake_categories');
    const theoryLinksBefore = await count(pool, 'theory_links');
    expect(categoriesBefore).toBeGreaterThan(0);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [`${randomUUID()}@example.com`],
    );
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 day')`,
      [rows[0]?.id, randomUUID()],
    );

    await resetUserData(pool);

    expect(await count(pool, 'users')).toBe(0);
    expect(await count(pool, 'refresh_tokens')).toBe(0);
    expect(await count(pool, 'mistake_categories')).toBe(categoriesBefore);
    expect(await count(pool, 'theory_links')).toBe(theoryLinksBefore);
  });

  it('[TC-00-04] refuses to truncate when connected to a non-test database', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ name: 'gototalk' }] });
    const devPool = { query } as unknown as pg.Pool;

    await expect(resetUserData(devPool)).rejects.toThrow(/_test/);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
