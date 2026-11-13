import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { WordUsageService } from '../src/modules/vocabulary/word-usage.service.js';
import { expectError } from './support/api-client.js';
import {
  postAnswer,
  startLearner,
  utteranceRows,
} from './support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiter,
} from './support/session-lock.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('step 1 transaction', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('[TC-04-03] answers 409 SESSION_FINISHED and stores nothing when the session finishes while the answer waits for the lock', async () => {
    const learner = await startLearner(app);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = postAnswer(
      app,
      learner.token,
      learner.session.id,
      'Hello',
    ).then((res) => res);
    try {
      await waitForLockWaiter(pool);
    } catch (error) {
      await holder.release();
      throw error;
    }
    await holder.finishAndRelease();
    const res = await pending;

    expectError(res, 409, 'SESSION_FINISHED');
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(1);
  });

  it('[TC-04-03] rolls the utterance back when recording the word usage fails', async () => {
    const learner = await startLearner(app);
    vi.spyOn(app.get(WordUsageService), 'recordUsage').mockRejectedValueOnce(
      new Error('word usage failed'),
    );

    const res = await postAnswer(
      app,
      learner.token,
      learner.session.id,
      'Hello',
    );

    expect(res.status).toBe(500);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.role)).toEqual(['assistant']);
  });
});
