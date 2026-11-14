import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { expect } from 'vitest';
import {
  MISTAKEN_ANSWER,
  PLAN,
  analyse,
  startLearner,
  submitAnswer,
} from './dialogue-flow.js';
import type { Learner } from './dialogue-flow.js';

export function getReport(
  app: INestApplication,
  token: string | null,
  sessionId: string,
) {
  const get = request(app.getHttpServer()).get(
    `/api/sessions/${sessionId}/report`,
  );
  return token === null ? get : get.set('Authorization', `Bearer ${token}`);
}

export async function finishSession(
  app: INestApplication,
  learner: Learner,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .post(`/api/sessions/${learner.session.id}/finish`)
    .set('Authorization', `Bearer ${learner.token}`);
  expect(res.status).toBe(200);
}

/** Starts a session, answers and analyses the given texts, and finishes it. */
export async function finishedLearner(
  app: INestApplication,
  answers: string[] = [MISTAKEN_ANSWER],
): Promise<Learner> {
  const learner = await startLearner(app);
  for (const text of answers) {
    await analyse(app, learner, await submitAnswer(app, learner, text));
  }
  await finishSession(app, learner);
  return learner;
}

/** Starting another session finishes the previous one without the finish endpoint. */
export async function startNextSession(
  app: INestApplication,
  token: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .post('/api/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send(PLAN);
  expect(res.status).toBe(201);
}
