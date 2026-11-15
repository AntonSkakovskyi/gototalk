import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from '../../support/api-client.js';
import {
  MISTAKEN_ANSWER,
  postAnalysis,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('step 2 access and ids', () => {
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

  it('[TC-04-03] returns 401 without a token', async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/sessions/${randomUUID()}/utterances/${randomUUID()}/analysis`,
    );

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-03] returns 401 when the user no longer exists', async () => {
    const res = await postAnalysis(
      app,
      await tokenOfMissingUser(app),
      randomUUID(),
      randomUUID(),
    );

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-03] returns 403 CONSENT_REQUIRED without consent and changes nothing', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const other = await registerUser(app);

    const res = await postAnalysis(
      app,
      other.token,
      learner.session.id,
      utteranceId,
    );

    expectError(res, 403, 'CONSENT_REQUIRED');
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows[1]?.analysis_status).toBe('pending');
  });

  it('[TC-04-03] gives the same 404 for a foreign, unknown and malformed session id', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const intruder = await registerUser(app);
    await grantConsent(app, intruder.token);

    const bodies: unknown[] = [];
    for (const sessionId of [learner.session.id, randomUUID(), 'not-a-uuid']) {
      const res = await postAnalysis(
        app,
        intruder.token,
        sessionId,
        utteranceId,
      );
      expectError(res, 404, 'SESSION_NOT_FOUND');
      bodies.push(res.body);
    }

    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows[1]?.analysis_status).toBe('pending');
  });

  it('[TC-04-03] gives the same 404 for an assistant, unknown, malformed and other-session utterance id', async () => {
    const learner = await startLearner(app);
    const other = await startLearner(app);
    const foreignUtterance = await submitAnswer(app, other, MISTAKEN_ANSWER);
    const assistantId = (await utteranceRows(pool, learner.session.id))[0]?.id;
    if (assistantId === undefined) throw new Error('Expected a question');

    const bodies: unknown[] = [];
    for (const utteranceId of [
      assistantId,
      randomUUID(),
      'not-a-uuid',
      foreignUtterance,
    ]) {
      const res = await postAnalysis(
        app,
        learner.token,
        learner.session.id,
        utteranceId,
      );
      expectError(res, 404, 'UTTERANCE_NOT_FOUND');
      bodies.push(res.body);
    }

    for (const body of bodies) expect(body).toEqual(bodies[0]);
    const rows = await utteranceRows(pool, other.session.id);
    expect(rows[1]?.analysis_status).toBe('pending');
  });
});
