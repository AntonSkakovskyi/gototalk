import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';

export function postHint(
  app: INestApplication,
  token: string,
  sessionId: string,
  body?: object,
) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${sessionId}/hints`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

export interface HintRow {
  kind: string;
  text: string;
  utterance_id: string | null;
  word_id: string | null;
}

export async function hintRows(
  pool: pg.Pool,
  sessionId: string,
): Promise<HintRow[]> {
  const { rows } = await pool.query<HintRow>(
    `SELECT kind, text, utterance_id, word_id FROM hints
      WHERE session_id = $1 ORDER BY text`,
    [sessionId],
  );
  return rows;
}

export interface HintedWordRow {
  id: string;
  lemma: string;
  translation_uk: string | null;
  state: string;
  source: string;
  times_used: number;
}

export async function hintedWordRows(
  pool: pg.Pool,
  userId: string,
): Promise<HintedWordRow[]> {
  const { rows } = await pool.query<HintedWordRow>(
    `SELECT id, lemma, translation_uk, state, source, times_used
       FROM words WHERE user_id = $1 ORDER BY lemma`,
    [userId],
  );
  return rows;
}
