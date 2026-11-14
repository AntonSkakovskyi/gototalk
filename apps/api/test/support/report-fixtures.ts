import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export const REPORT_STARTED_AT = '2026-11-10T10:00:00Z';

export async function insertMistake(
  pool: pg.Pool,
  utteranceId: string,
  category: string,
  options: { isFalse?: boolean; suggestion?: string | null; pos?: number } = {},
): Promise<void> {
  const { isFalse = false, suggestion = 'fixed', pos = 0 } = options;
  await pool.query(
    `INSERT INTO mistakes (utterance_id, category, original, suggestion, start_pos, end_pos, is_false)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      utteranceId,
      category,
      `orig-${randomUUID()}`,
      suggestion,
      pos,
      pos + 3,
      isFalse,
    ],
  );
}

export async function setUtteranceCreatedAt(
  pool: pg.Pool,
  utteranceId: string,
  at: string,
): Promise<void> {
  await pool.query('UPDATE utterances SET created_at = $2 WHERE id = $1', [
    utteranceId,
    at,
  ]);
}

export async function insertLinkedWord(
  pool: pg.Pool,
  userId: string,
  lemma: string,
  createdAt: string,
  sessionId?: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO words (user_id, lemma, translation_uk, state, source, created_at)
     VALUES ($1, $2, $3, 'partial', 'hint', $4) RETURNING id`,
    [userId, lemma, `${lemma}-uk`, createdAt],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Word insert returned no row');
  if (sessionId) {
    await pool.query(
      'INSERT INTO session_words (session_id, word_id) VALUES ($1, $2)',
      [sessionId, id],
    );
  }
  return id;
}
