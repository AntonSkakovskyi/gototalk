import type { INestApplication } from '@nestjs/common';
import { SessionDetailsSchema, TurnResultSchema } from '@gototalk/shared';
import type { SessionDetails, TurnResult } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { expect } from 'vitest';
import { grantConsent, registerUser } from './api-client.js';
import type { RegisteredUser } from './api-client.js';

export const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: [
    'What are you doing this weekend?',
    'Who do you usually spend it with?',
    'Where do you like to go?',
    'What did you do last weekend?',
    'What would be your perfect weekend?',
  ],
};

export const MISTAKEN_ANSWER =
  'Yesterday I go to the office. I very like my job.';

export interface Learner extends RegisteredUser {
  session: SessionDetails;
}

export async function startLearner(app: INestApplication): Promise<Learner> {
  const user = await registerUser(app);
  await grantConsent(app, user.token);
  const res = await request(app.getHttpServer())
    .post('/api/sessions')
    .set('Authorization', `Bearer ${user.token}`)
    .send(PLAN);
  expect(res.status).toBe(201);
  return { ...user, session: SessionDetailsSchema.parse(res.body) };
}

export function postAnswer(
  app: INestApplication,
  token: string,
  sessionId: string,
  text: string,
) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${sessionId}/utterances`)
    .set('Authorization', `Bearer ${token}`)
    .send({ text });
}

export function postAnalysis(
  app: INestApplication,
  token: string,
  sessionId: string,
  utteranceId: string,
) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${sessionId}/utterances/${utteranceId}/analysis`)
    .set('Authorization', `Bearer ${token}`);
}

export async function submitAnswer(
  app: INestApplication,
  learner: Learner,
  text: string,
): Promise<string> {
  const res = await postAnswer(app, learner.token, learner.session.id, text);
  expect(res.status).toBe(201);
  const id: unknown = res.body.id;
  if (typeof id !== 'string') throw new Error('Expected an utterance id');
  return id;
}

export async function analyse(
  app: INestApplication,
  learner: Learner,
  utteranceId: string,
): Promise<TurnResult> {
  const res = await postAnalysis(
    app,
    learner.token,
    learner.session.id,
    utteranceId,
  );
  expect(res.status).toBe(200);
  return TurnResultSchema.parse(res.body);
}

export async function fetchDetails(
  app: INestApplication,
  learner: Learner,
): Promise<SessionDetails> {
  const res = await request(app.getHttpServer())
    .get(`/api/sessions/${learner.session.id}`)
    .set('Authorization', `Bearer ${learner.token}`);
  expect(res.status).toBe(200);
  return SessionDetailsSchema.parse(res.body);
}

export interface UtteranceRow {
  id: string;
  seq: number;
  role: string;
  text_verbatim: string;
  analysis_status: string;
  analysis_prompt_version: string | null;
  analysis_model: string | null;
  analyzed_at: string | null;
  better_phrasings: unknown[];
}

export async function utteranceRows(
  pool: pg.Pool,
  sessionId: string,
): Promise<UtteranceRow[]> {
  const { rows } = await pool.query<UtteranceRow>(
    `SELECT id, seq, role, text_verbatim, analysis_status, analysis_prompt_version,
            analysis_model, analyzed_at, better_phrasings
       FROM utterances WHERE session_id = $1 ORDER BY seq`,
    [sessionId],
  );
  return rows;
}

export interface MistakeRow {
  category: string;
  original: string;
  start_pos: number;
  end_pos: number;
  pattern_id: string | null;
}

export async function mistakeRows(
  pool: pg.Pool,
  utteranceId: string,
): Promise<MistakeRow[]> {
  const { rows } = await pool.query<MistakeRow>(
    `SELECT category, original, start_pos, end_pos, pattern_id
       FROM mistakes WHERE utterance_id = $1 ORDER BY start_pos`,
    [utteranceId],
  );
  return rows;
}

export interface PatternRow {
  id: string;
  category: string;
  frequency: number;
  last_seen_at: string | null;
}

export async function patternRows(
  pool: pg.Pool,
  userId: string,
): Promise<PatternRow[]> {
  const { rows } = await pool.query<PatternRow>(
    `SELECT id, category, frequency, last_seen_at
       FROM mistake_patterns WHERE user_id = $1 ORDER BY category`,
    [userId],
  );
  return rows;
}

export async function countMistakes(
  pool: pg.Pool,
  sessionId: string,
): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM mistakes m JOIN utterances u ON u.id = m.utterance_id
      WHERE u.session_id = $1`,
    [sessionId],
  );
  return Number(rows[0]?.count);
}

export async function seedWords(
  pool: pg.Pool,
  userId: string,
  words: [lemma: string, state: string][],
): Promise<void> {
  for (const [lemma, state] of words) {
    await pool.query(
      `INSERT INTO words (user_id, lemma, state, times_used) VALUES ($1, $2, $3, 1)`,
      [userId, lemma, state],
    );
  }
}

export async function wordRows(
  pool: pg.Pool,
  userId: string,
): Promise<{ lemma: string; state: string; times_used: number }[]> {
  const { rows } = await pool.query(
    'SELECT lemma, state, times_used FROM words WHERE user_id = $1 ORDER BY lemma',
    [userId],
  );
  return rows;
}
