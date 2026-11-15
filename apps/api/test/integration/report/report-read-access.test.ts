import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import {
  MISSING_USER_ID,
  grantConsent,
  expectError,
  registerUser,
  tokenOfMissingUser,
} from '../../support/api-client.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import { startLearner } from '../../support/dialogue-flow.js';
import { finishedLearner, getReport } from '../../support/report-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('GET /api/sessions/:id/report access', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  const model = new ControllableLanguageModel();

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: LANGUAGE_MODEL_PORT, useValue: model }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    model.reset();
  });

  it('[TC-05-02] answers the same 404 for a foreign, unknown and malformed id', async () => {
    const owner = await finishedLearner(app);
    model.calls.summarize = 0;
    const other = await registerUser(app);
    await grantConsent(app, other.token);

    const responses = [
      await getReport(app, other.token, owner.session.id),
      await getReport(app, owner.token, MISSING_USER_ID),
      await getReport(app, owner.token, 'not-a-uuid'),
    ];

    for (const res of responses) {
      expectError(res, 404, 'SESSION_NOT_FOUND');
      expect(res.body).toEqual(responses[0]?.body);
    }
    expect(model.calls.summarize).toBe(0);
  });

  it('[TC-05-02] answers 409 SESSION_NOT_FINISHED for an active session without calling the model', async () => {
    const learner = await startLearner(app);

    const res = await getReport(app, learner.token, learner.session.id);

    expectError(res, 409, 'SESSION_NOT_FINISHED');
    expect(model.calls.summarize).toBe(0);
  });

  it('[TC-05-02] requires consent because the endpoint can call the model', async () => {
    const learner = await finishedLearner(app);
    model.calls.summarize = 0;
    await pool.query('UPDATE users SET consent_at = NULL WHERE id = $1', [
      learner.id,
    ]);

    const res = await getReport(app, learner.token, learner.session.id);

    expectError(res, 403, 'CONSENT_REQUIRED');
    expect(model.calls.summarize).toBe(0);
  });

  it('[TC-05-02] returns 401 without a token', async () => {
    const learner = await finishedLearner(app);

    const res = await getReport(app, null, learner.session.id);

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-05-02] returns 401 for a deleted user with a still valid token', async () => {
    const learner = await finishedLearner(app);

    const res = await getReport(
      app,
      await tokenOfMissingUser(app),
      learner.session.id,
    );

    expectError(res, 401, 'UNAUTHORIZED');
  });
});
