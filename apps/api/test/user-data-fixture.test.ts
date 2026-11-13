import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest';
import { resetUserData } from './support/test-db.js';
import {
  REFERENCE_TABLES,
  USER_DATA_TABLES,
  countUserData,
  insertUserData,
} from './support/user-data.js';

const SET_NULL_FOREIGN_KEYS = new Set([
  'mistakes.pattern_id',
  'hints.utterance_id',
  'hints.word_id',
]);

describe('user data fixture', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function createUser(): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [`${randomUUID()}@example.com`],
    );
    return rows[0]?.id as string;
  }

  it('[TC-01-02] inserts exactly one row into every user-owned table', async () => {
    const userId = await createUser();

    await insertUserData(pool, userId);

    const counts = await countUserData(pool, userId);
    for (const table of USER_DATA_TABLES) {
      expect(counts[table], table).toBe(1);
    }
  });

  it('[TC-01-06] counts rows per user, not per table', async () => {
    const a = await createUser();
    const b = await createUser();
    await insertUserData(pool, a);
    await insertUserData(pool, b);

    const counts = await countUserData(pool, a);

    for (const table of USER_DATA_TABLES) {
      expect(counts[table], table).toBe(1);
    }
  });

  it('[TC-01-02] every public table is either users, user data or reference data', async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const known = new Set<string>([
      'users',
      ...USER_DATA_TABLES,
      ...REFERENCE_TABLES,
    ]);

    expect(rows.map((r) => r.tablename).filter((t) => !known.has(t))).toEqual(
      [],
    );
  });

  it('[TC-01-02] every foreign key to users cascades on delete', async () => {
    const { rows } = await pool.query<{ table: string; rule: string }>(
      `SELECT conrelid::regclass::text AS "table", confdeltype AS rule
       FROM pg_constraint
       WHERE contype = 'f' AND confrelid = 'users'::regclass`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const { table, rule } of rows) {
      expect(rule, `${table} must reference users ON DELETE CASCADE`).toBe('c');
      expect(USER_DATA_TABLES, table).toContain(table);
    }
  });

  it('[TC-01-02] foreign keys between user-owned tables cascade except the allowed SET NULL ones', async () => {
    const owned = USER_DATA_TABLES.map((t) => `'${t}'::regclass`).join(', ');
    const { rows } = await pool.query<{ fk: string; rule: string }>(
      `SELECT c.conrelid::regclass::text || '.' || a.attname AS fk, c.confdeltype AS rule
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.contype = 'f' AND c.conrelid IN (${owned}) AND c.confrelid IN (${owned})`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const { fk, rule } of rows) {
      const expected = SET_NULL_FOREIGN_KEYS.has(fk) ? 'n' : 'c';
      expect(rule, fk).toBe(expected);
    }
  });
});
