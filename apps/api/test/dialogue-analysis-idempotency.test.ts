import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  analyse,
  countMistakes,
  patternRows,
  postAnalysis,
  startLearner,
  submitAnswer,
  utteranceRows,
} from './support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiters,
} from './support/session-lock.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('step 2 idempotency', () => {
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

  it('[TC-04-02] returns the same result on a repeat call without a model call or a new row', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const first = await analyse(app, learner, utteranceId);
    const second = await analyse(app, learner, utteranceId);

    expect(second).toEqual(first);
    expect(model.calls).toEqual({ analyze: 1, nextTurn: 1, hint: 0 });
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(3);
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await patternRows(pool, learner.id)).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
  });

  it('[TC-04-02] stores one reply, one set of mistakes and one pattern increment for parallel calls', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = [1, 2].map(() =>
      postAnalysis(app, learner.token, learner.session.id, utteranceId).then(
        (res) => res,
      ),
    );
    try {
      await waitForLockWaiters(pool, 2);
    } finally {
      await holder.release();
    }
    const [first, second] = await Promise.all(pending);

    expect(first?.status).toBe(200);
    expect(second?.status).toBe(200);
    expect(second?.body).toEqual(first?.body);
    expect(first?.body).toMatchObject({
      utterance: { id: utteranceId, analysisStatus: 'done' },
      reply: { seq: 3 },
    });
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await patternRows(pool, learner.id)).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
  });

  it('[TC-04-02] does not ask for a second reply to an answer that is no longer the last one', async () => {
    const learner = await startLearner(app);
    const first = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    await analyse(app, learner, first);
    const second = await submitAnswer(app, learner, 'I like football.');
    await analyse(app, learner, second);
    model.reset();

    const again = await analyse(app, learner, first);

    expect(again.reply?.seq).toBe(3);
    expect(model.calls).toEqual({ analyze: 0, nextTurn: 0, hint: 0 });
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(5);
  });
});
