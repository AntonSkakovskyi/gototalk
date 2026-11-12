import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

// Таблиці з 0001 (13) і 0002 (refresh_tokens, mistake_categories)
const EXPECTED_TABLES = [
  'cards',
  'exercises',
  'goals',
  'hints',
  'mistake_categories',
  'mistake_patterns',
  'mistakes',
  'profiles',
  'refresh_tokens',
  'session_reports',
  'sessions',
  'theory_links',
  'users',
  'utterances',
  'words',
];

// CHECK-обмеження в форматі `таблиця.ім'я` (імена автогенеровані Postgres для inline-CHECK).
// 0001: 12 inline-CHECK (words_state_check з 0001 замінює 0002, тож рахується один раз);
// 0002: 4 нові CHECK.
const EXPECTED_CHECKS = [
  // 0001
  'profiles.profiles_level_check',
  'goals.goals_status_check',
  'sessions.sessions_topic_source_check',
  'sessions.sessions_feedback_mode_check',
  'sessions.sessions_status_check',
  'utterances.utterances_role_check',
  'mistake_patterns.mistake_patterns_frequency_check',
  'words.words_state_check',
  'words.words_source_check',
  'hints.hints_kind_check',
  'cards.cards_interval_days_check',
  'exercises.exercises_kind_check',
  // 0002
  'mistakes.chk_mistakes_span',
  'utterances.utterances_analysis_status_check',
  'words.chk_words_times_used',
  'profiles.chk_profiles_interface_lang',
];

describe('схема БД після міграцій', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[TC-00-01] у схемі public рівно 15 очікуваних таблиць', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );

    expect(rows.map((row) => row.table_name)).toEqual(
      [...EXPECTED_TABLES].sort(),
    );
    expect(rows).toHaveLength(15);
  });

  it('[TC-00-01] у public є всі очікувані CHECK-обмеження й жодного зайвого', async () => {
    const { rows } = await pool.query<{ check_name: string }>(
      `SELECT c.conrelid::regclass::text || '.' || c.conname AS check_name
       FROM pg_constraint c
       WHERE c.contype = 'c' AND c.connamespace = 'public'::regnamespace
       ORDER BY check_name`,
    );

    expect(rows.map((row) => row.check_name)).toEqual(
      [...EXPECTED_CHECKS].sort(),
    );
    expect(rows).toHaveLength(16);
  });

  it('[TC-00-01] words_state_check із 0002 допускає стан active', async () => {
    const { rows } = await pool.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname = 'words_state_check' AND conrelid = 'public.words'::regclass`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.definition).toContain("'active'");
  });

  it('[TC-00-01] у журналі drizzle.__drizzle_migrations 3 рядки', async () => {
    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(*) AS count FROM drizzle.__drizzle_migrations',
    );

    expect(Number(rows[0]?.count)).toBe(3);
  });
});
