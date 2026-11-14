import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export const USER_DATA_TABLES = [
  'profiles',
  'goals',
  'sessions',
  'utterances',
  'mistake_patterns',
  'mistakes',
  'words',
  'hints',
  'session_words',
  'cards',
  'exercises',
  'session_reports',
  'refresh_tokens',
] as const;

export type UserDataTable = (typeof USER_DATA_TABLES)[number];

export const REFERENCE_TABLES = ['mistake_categories', 'theory_links'] as const;

export type ReferenceTable = (typeof REFERENCE_TABLES)[number];

// Tables with a user_id column reference users directly; the rest are reached through their parents.
const COUNT_QUERIES: Record<UserDataTable, string> = {
  profiles: 'SELECT count(*) FROM profiles WHERE user_id = $1',
  goals: 'SELECT count(*) FROM goals WHERE user_id = $1',
  sessions: 'SELECT count(*) FROM sessions WHERE user_id = $1',
  mistake_patterns: 'SELECT count(*) FROM mistake_patterns WHERE user_id = $1',
  words: 'SELECT count(*) FROM words WHERE user_id = $1',
  refresh_tokens: 'SELECT count(*) FROM refresh_tokens WHERE user_id = $1',
  utterances: `SELECT count(*) FROM utterances u
    JOIN sessions s ON s.id = u.session_id WHERE s.user_id = $1`,
  hints: `SELECT count(*) FROM hints h
    JOIN sessions s ON s.id = h.session_id WHERE s.user_id = $1`,
  session_words: `SELECT count(*) FROM session_words sw
    JOIN sessions s ON s.id = sw.session_id WHERE s.user_id = $1`,
  session_reports: `SELECT count(*) FROM session_reports r
    JOIN sessions s ON s.id = r.session_id WHERE s.user_id = $1`,
  mistakes: `SELECT count(*) FROM mistakes m
    JOIN utterances u ON u.id = m.utterance_id
    JOIN sessions s ON s.id = u.session_id WHERE s.user_id = $1`,
  cards: `SELECT count(*) FROM cards c
    JOIN words w ON w.id = c.word_id WHERE w.user_id = $1`,
  exercises: `SELECT count(*) FROM exercises e
    JOIN cards c ON c.id = e.card_id
    JOIN words w ON w.id = c.word_id WHERE w.user_id = $1`,
};

export type UserDataCounts = Record<UserDataTable, number>;

export async function countUserData(
  pool: pg.Pool,
  userId: string,
): Promise<UserDataCounts> {
  const counts = {} as UserDataCounts;
  for (const table of USER_DATA_TABLES) {
    const { rows } = await pool.query<{ count: string }>(COUNT_QUERIES[table], [
      userId,
    ]);
    counts[table] = Number(rows[0]?.count);
  }
  return counts;
}

export async function countReferenceData(
  pool: pg.Pool,
): Promise<Record<ReferenceTable, number>> {
  const counts = {} as Record<ReferenceTable, number>;
  for (const table of REFERENCE_TABLES) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM ${table}`,
    );
    counts[table] = Number(rows[0]?.count);
  }
  return counts;
}

async function insertId(
  pool: pg.Pool,
  sql: string,
  params: unknown[],
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (!id) throw new Error('Fixture insert returned no id');
  return id;
}

/** Inserts one row into every user-owned table; theoryLinkId optionally links the pattern to a reference row. */
export async function insertUserData(
  pool: pg.Pool,
  userId: string,
  options: { theoryLinkId?: string } = {},
): Promise<void> {
  await pool.query(`INSERT INTO profiles (user_id, level) VALUES ($1, 'B1')`, [
    userId,
  ]);
  await pool.query(`INSERT INTO goals (user_id, title) VALUES ($1, 'Goal')`, [
    userId,
  ]);
  const sessionId = await insertId(
    pool,
    `INSERT INTO sessions (user_id, topic) VALUES ($1, 'Topic') RETURNING id`,
    [userId],
  );
  const utteranceId = await insertId(
    pool,
    `INSERT INTO utterances (session_id, seq, role, text_verbatim)
     VALUES ($1, 1, 'user', 'I go to shop') RETURNING id`,
    [sessionId],
  );
  const patternId = await insertId(
    pool,
    `INSERT INTO mistake_patterns (user_id, category, frequency, theory_link_id)
     VALUES ($1, 'articles', 1, $2) RETURNING id`,
    [userId, options.theoryLinkId ?? null],
  );
  await pool.query(
    `INSERT INTO mistakes (utterance_id, pattern_id, category, original, start_pos, end_pos)
     VALUES ($1, $2, 'articles', 'shop', 8, 12)`,
    [utteranceId, patternId],
  );
  const wordId = await insertId(
    pool,
    `INSERT INTO words (user_id, lemma) VALUES ($1, $2) RETURNING id`,
    [userId, `lemma-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO hints (session_id, utterance_id, kind, text, word_id)
     VALUES ($1, $2, 'translation', 'hint', $3)`,
    [sessionId, utteranceId, wordId],
  );
  await pool.query(
    `INSERT INTO session_words (session_id, word_id) VALUES ($1, $2)`,
    [sessionId, wordId],
  );
  const cardId = await insertId(
    pool,
    `INSERT INTO cards (word_id, front, back) VALUES ($1, 'front', 'back') RETURNING id`,
    [wordId],
  );
  await pool.query(
    `INSERT INTO exercises (card_id, prompt, expected) VALUES ($1, 'I ___ home', 'go')`,
    [cardId],
  );
  await pool.query(
    `INSERT INTO session_reports (session_id, summary, prompt_version, model)
     VALUES ($1, 'Summary', 'session-summary.v1', 'fake')`,
    [sessionId],
  );
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 day')`,
    [userId, `fixture-${randomUUID()}`],
  );
}
