import { Logger } from '@nestjs/common';
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
import { LANGUAGE_MODEL_PORT } from '../src/integrations/language-model/language-model.port.js';
import { expectError } from './support/api-client.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import { startLearner } from './support/dialogue-flow.js';
import { hintRows, hintedWordRows, postHint } from './support/hints-flow.js';
import { insertUtterance } from './support/session-fixtures.js';
import {
  SessionLockHolder,
  waitForLockWaiter,
} from './support/session-lock.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const TRANSLATION = { kind: 'translation', word: 'зустріч' };

describe('hints with the Fake unavailable mode', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp({ env: { FAKE_LLM_FAIL: 'unavailable' } });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  it('[TC-04-10] answers 503 LANGUAGE_MODEL_UNAVAILABLE and stores nothing', async () => {
    const learner = await startLearner(app);

    expectError(
      await postHint(app, learner.token, learner.session.id, TRANSLATION),
      503,
      'LANGUAGE_MODEL_UNAVAILABLE',
    );

    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
  });
});

describe('hints when the model misbehaves or the session changes', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['a broken shape', { kind: 'translation', word: 42 }],
    ['the other kind', { kind: 'phrase_start', text: 'I think that…' }],
  ])(
    '[TC-04-10] answers 502 after two invalid answers (%s) and stores nothing',
    async (_label, output) => {
      const learner = await startLearner(app);
      model.hintOutput = output;

      expectError(
        await postHint(app, learner.token, learner.session.id, TRANSLATION),
        502,
        'LANGUAGE_MODEL_INVALID_RESPONSE',
      );

      expect(model.calls.hint).toBe(2);
      expect(await hintRows(pool, learner.session.id)).toEqual([]);
      expect(await hintedWordRows(pool, learner.id)).toEqual([]);
    },
  );

  it('[TC-04-10] neither logs nor returns the typed word or the model output', async () => {
    const logs = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map(
      (method) => vi.spyOn(Logger.prototype, method),
    );
    const learner = await startLearner(app);
    model.hintOutput = {
      kind: 'translation',
      word: 42,
      message: 'MODEL-SENTINEL',
    };

    const res = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'WORD-SENTINEL',
    });

    expect(res.status).toBe(502);
    const seen = JSON.stringify([res.body, logs.map((spy) => spy.mock.calls)]);
    expect(seen).not.toContain('WORD-SENTINEL');
    expect(seen).not.toContain('MODEL-SENTINEL');
  });

  it('[TC-04-10] answers 409 and stores nothing when the session finishes during the model call', async () => {
    const learner = await startLearner(app);
    const hold = model.holdHint();

    const pending = postHint(
      app,
      learner.token,
      learner.session.id,
      TRANSLATION,
    ).then((res) => res);
    await hold.started;
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );
    hold.release();
    const res = await pending;

    expectError(res, 409, 'SESSION_FINISHED');
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
  });

  it('[TC-04-10] answers 409 ANSWER_NOT_EXPECTED and stores nothing when a new question appears during the model call', async () => {
    const learner = await startLearner(app);
    const hold = model.holdHint();

    const pending = postHint(
      app,
      learner.token,
      learner.session.id,
      TRANSLATION,
    ).then((res) => res);
    await hold.started;
    await insertUtterance(pool, learner.session.id, 2, 'assistant', 'Next?');
    hold.release();
    const res = await pending;

    expectError(res, 409, 'ANSWER_NOT_EXPECTED');
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
  });

  it('[TC-04-10] answers 409 and stores nothing when the session finishes while the write waits for the lock', async () => {
    const learner = await startLearner(app);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = postHint(
      app,
      learner.token,
      learner.session.id,
      TRANSLATION,
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
    expect(await hintRows(pool, learner.session.id)).toEqual([]);
    expect(await hintedWordRows(pool, learner.id)).toEqual([]);
  });
});
