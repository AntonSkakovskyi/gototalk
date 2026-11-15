import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  MISTAKEN_ANSWER,
  countMistakes,
  patternRows,
  postAnalysis,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiter,
} from '../../support/session-lock.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('step 2 under the session lock', () => {
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

  it('[TC-04-02] persists the analysis but adds no reply when the session finishes while the write waits for the lock', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    ).then((res) => res);
    try {
      await waitForLockWaiter(pool);
    } catch (error) {
      await holder.release();
      throw error;
    }
    await holder.finishAndRelease();
    const res = await pending;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      utterance: { id: utteranceId, analysisStatus: 'done' },
      reply: null,
    });
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.role)).toEqual(['assistant', 'user']);
    expect(rows[1]?.analysis_status).toBe('done');
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await patternRows(pool, learner.id)).toHaveLength(2);
  });

  it('[TC-04-02] analyses a pending answer of a finished session without a reply', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );

    const res = await postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      utterance: { analysisStatus: 'done' },
      reply: null,
    });
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(2);
  });
});
