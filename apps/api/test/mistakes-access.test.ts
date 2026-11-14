import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { expectError } from './support/api-client.js';
import { startLearner } from './support/dialogue-flow.js';
import {
  analysedLearner,
  frequencies,
  patchMistake,
} from './support/mistakes-flow.js';
import { insertFinished } from './support/session-fixtures.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('PATCH /api/sessions/:id/mistakes/:mistakeId access and validation', () => {
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

  it('[TC-04-09] answers an identical 404 MISTAKE_NOT_FOUND for a foreign, other-session, unknown and malformed mistake id', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    const stranger = await startLearner(app);
    const otherSession = await insertFinished(
      pool,
      learner.id,
      'Other',
      '2026-11-01 10:00:00+00',
    );

    const responses = [
      await patchMistake(
        app,
        stranger.token,
        stranger.session.id,
        verbTense.id,
      ),
      await patchMistake(app, learner.token, otherSession, verbTense.id),
      await patchMistake(app, learner.token, learner.session.id, randomUUID()),
      await patchMistake(app, learner.token, learner.session.id, 'not-a-uuid'),
    ];

    for (const res of responses) {
      expectError(res, 404, 'MISTAKE_NOT_FOUND');
    }
    expect(new Set(responses.map((res) => JSON.stringify(res.body))).size).toBe(
      1,
    );
    expect(await frequencies(pool, learner.id)).toEqual({
      verb_tense: 1,
      word_order: 1,
    });
  });

  it('[TC-04-09] answers an identical 404 SESSION_NOT_FOUND for a foreign, unknown and malformed session id', async () => {
    const { learner, verbTense } = await analysedLearner(app);
    const stranger = await startLearner(app);

    const responses = [
      await patchMistake(app, stranger.token, learner.session.id, verbTense.id),
      await patchMistake(app, learner.token, randomUUID(), verbTense.id),
      await patchMistake(app, learner.token, 'not-a-uuid', verbTense.id),
    ];

    for (const res of responses) {
      expectError(res, 404, 'SESSION_NOT_FOUND');
    }
    expect(new Set(responses.map((res) => JSON.stringify(res.body))).size).toBe(
      1,
    );
  });

  it.each([{ isFalse: false }, {}, { isFalse: 'true' }])(
    '[TC-04-09] rejects the body %j with 400 VALIDATION_ERROR',
    async (body) => {
      const { learner, verbTense } = await analysedLearner(app);

      const res = await patchMistake(
        app,
        learner.token,
        learner.session.id,
        verbTense.id,
        body,
      );

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(await frequencies(pool, learner.id)).toMatchObject({
        verb_tense: 1,
      });
    },
  );

  it('[TC-04-09] answers 401 without a token', async () => {
    const { learner, verbTense } = await analysedLearner(app);

    const res = await patchMistake(app, null, learner.session.id, verbTense.id);

    expectError(res, 401, 'UNAUTHORIZED');
  });
});
