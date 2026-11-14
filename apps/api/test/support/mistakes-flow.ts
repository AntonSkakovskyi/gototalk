import type { INestApplication } from '@nestjs/common';
import type { MistakeView } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import {
  MISTAKEN_ANSWER,
  analyse,
  startLearner,
  submitAnswer,
} from './dialogue-flow.js';
import type { Learner } from './dialogue-flow.js';

export interface AnalysedLearner {
  learner: Learner;
  verbTense: MistakeView;
  wordOrder: MistakeView;
}

export async function analysedLearner(
  app: INestApplication,
): Promise<AnalysedLearner> {
  const learner = await startLearner(app);
  const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
  const { utterance } = await analyse(app, learner, utteranceId);
  const verbTense = utterance.mistakes.find((m) => m.category === 'verb_tense');
  const wordOrder = utterance.mistakes.find((m) => m.category === 'word_order');
  if (!verbTense || !wordOrder) throw new Error('Expected two mistakes');
  return { learner, verbTense, wordOrder };
}

export function patchMistake(
  app: INestApplication,
  token: string | null,
  sessionId: string,
  mistakeId: string,
  body: object = { isFalse: true },
) {
  const patch = request(app.getHttpServer()).patch(
    `/api/sessions/${sessionId}/mistakes/${mistakeId}`,
  );
  return (
    token === null ? patch : patch.set('Authorization', `Bearer ${token}`)
  ).send(body);
}

export async function setFrequency(
  pool: pg.Pool,
  userId: string,
  category: string,
  frequency: number,
): Promise<void> {
  await pool.query(
    'UPDATE mistake_patterns SET frequency = $3 WHERE user_id = $1 AND category = $2',
    [userId, category, frequency],
  );
}

export async function frequencies(
  pool: pg.Pool,
  userId: string,
): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ category: string; frequency: number }>(
    'SELECT category, frequency FROM mistake_patterns WHERE user_id = $1',
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.category, r.frequency]));
}
