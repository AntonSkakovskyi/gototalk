import type { INestApplication } from '@nestjs/common';
import { SessionSchema } from '@gototalk/shared';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import {
  MISSING_USER_ID,
  expectError,
  registerUser,
} from './support/api-client.js';
import {
  PLAN,
  fetchDetails,
  postAnalysis,
  postAnswer,
  startLearner,
  submitAnswer,
} from './support/dialogue-flow.js';
import type { Learner } from './support/dialogue-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('POST /api/sessions/:id/finish', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  const finish = (token: string, id: string) =>
    request(app.getHttpServer())
      .post(`/api/sessions/${id}/finish`)
      .set('Authorization', `Bearer ${token}`);

  async function finishOk(learner: Learner) {
    const res = await finish(learner.token, learner.session.id);
    expect(res.status).toBe(200);
    return SessionSchema.parse(res.body);
  }

  it('[TC-04-05] finishes the active session and returns it with ended_at', async () => {
    const learner = await startLearner(app);

    const session = await finishOk(learner);

    expect(session).toMatchObject({
      id: learner.session.id,
      status: 'finished',
      topic: PLAN.topic,
    });
    expect(session.endedAt).not.toBeNull();
  });

  it('[TC-04-05] returns the stored state with the same ended_at on a repeat call', async () => {
    const learner = await startLearner(app);
    const first = await finishOk(learner);

    const second = await finishOk(learner);

    expect(second).toEqual(first);
  });

  it('[TC-04-05] shows the session as finished in the read endpoints', async () => {
    const learner = await startLearner(app);
    const finished = await finishOk(learner);

    const details = await fetchDetails(app, learner);
    const list = await request(app.getHttpServer())
      .get('/api/sessions')
      .set('Authorization', `Bearer ${learner.token}`);

    expect(details).toMatchObject({
      status: 'finished',
      endedAt: finished.endedAt,
    });
    expect(list.body).toMatchObject([
      { id: learner.session.id, status: 'finished' },
    ]);
  });

  it('[TC-04-05] rejects a new answer with 409 SESSION_FINISHED', async () => {
    const learner = await startLearner(app);
    await finishOk(learner);

    const res = await postAnswer(app, learner.token, learner.session.id, 'Hi');

    expectError(res, 409, 'SESSION_FINISHED');
  });

  it('[TC-04-05] lets the user start a new session afterwards', async () => {
    const learner = await startLearner(app);
    await finishOk(learner);

    const res = await request(app.getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${learner.token}`)
      .send(PLAN);

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(learner.session.id);
  });

  it('[TC-04-05] analyses a pending answer after the finish without a reply', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, 'I like my weekend.');
    await finishOk(learner);

    const res = await postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      utterance: { id: utteranceId },
      reply: null,
    });
    expect(res.body.utterance.analysisStatus).not.toBe('pending');
  });

  it('[TC-04-05] answers the same 404 for a foreign, unknown and malformed id', async () => {
    const owner = await startLearner(app);
    const other = await registerUser(app);

    const responses = [
      await finish(other.token, owner.session.id),
      await finish(owner.token, MISSING_USER_ID),
      await finish(owner.token, 'not-a-uuid'),
    ];

    for (const res of responses) {
      expectError(res, 404, 'SESSION_NOT_FOUND');
      expect(res.body).toEqual(responses[0]?.body);
    }
    expect((await fetchDetails(app, owner)).status).toBe('active');
  });

  it('[TC-04-05] returns 401 without a token', async () => {
    const learner = await startLearner(app);

    const res = await request(app.getHttpServer()).post(
      `/api/sessions/${learner.session.id}/finish`,
    );

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-05] needs no consent', async () => {
    const learner = await startLearner(app);
    await pool.query('UPDATE users SET consent_at = NULL WHERE id = $1', [
      learner.id,
    ]);

    const session = await finishOk(learner);

    expect(session.status).toBe('finished');
  });
});
