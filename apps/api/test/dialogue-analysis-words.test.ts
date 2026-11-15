import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../src/integrations/language-model/language-model.port.js';
import { PendingAnalysisService } from '../src/modules/analysis/pending-analysis.service.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  SEEDED_WORD_SOURCE,
  analyse,
  countMistakes,
  postAnalysis,
  seedWords,
  sessionWordRows,
  startLearner,
  submitAnswer,
  wordRows,
} from './support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiters,
} from './support/session-lock.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const REALLY = { lemma: 'really', state: 'new', source: 'session' };
const WENT = { lemma: 'went', state: 'new', source: 'session' };
const SESSION_WORDS = [REALLY, WENT];

describe('session words recorded by the analysis', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let pendingAnalysis: PendingAnalysisService;
  const model = new ControllableLanguageModel();

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: LANGUAGE_MODEL_PORT, useValue: model }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
    pendingAnalysis = app.get(PendingAnalysisService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
    model.reset();
  });

  it('[TC-05-01] creates new session words for the corrected tokens and links them to the session', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await analyse(app, learner, utteranceId);

    expect(await sessionWordRows(pool, learner.session.id)).toEqual(
      SESSION_WORDS,
    );
    expect((await wordRows(pool, learner.id)).map((row) => row.lemma)).toEqual([
      'really',
      'went',
    ]);
  });

  it('[TC-05-01] keeps the state and lemma of an existing word with another case but links it', async () => {
    const learner = await startLearner(app);
    await seedWords(pool, learner.id, [['Went', 'passive']]);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await analyse(app, learner, utteranceId);

    expect(await sessionWordRows(pool, learner.session.id)).toEqual([
      REALLY,
      { lemma: 'Went', state: 'passive', source: SEEDED_WORD_SOURCE },
    ]);
    expect(await wordRows(pool, learner.id)).toHaveLength(2);
  });

  it('[TC-05-01] creates no duplicate words or links on a repeat call', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await analyse(app, learner, utteranceId);
    await analyse(app, learner, utteranceId);

    expect(await sessionWordRows(pool, learner.session.id)).toEqual(
      SESSION_WORDS,
    );
    expect(await wordRows(pool, learner.id)).toHaveLength(2);
  });

  it('[TC-05-01] records the words when the pending analysis is completed later', async () => {
    const learner = await startLearner(app);
    await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await pendingAnalysis.complete(learner.id, learner.session.id);
    await pendingAnalysis.complete(learner.id, learner.session.id);

    expect(await sessionWordRows(pool, learner.session.id)).toEqual(
      SESSION_WORDS,
    );
    expect(await wordRows(pool, learner.id)).toHaveLength(2);
  });

  it('[TC-05-01] records one set of words and links when two completions run in parallel', async () => {
    const learner = await startLearner(app);
    await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const pending = [1, 2].map(() =>
      pendingAnalysis.complete(learner.id, learner.session.id),
    );
    try {
      await waitForLockWaiters(pool, 2);
    } finally {
      await holder.release();
    }

    await expect(Promise.all(pending)).resolves.toEqual([true, true]);
    expect(await sessionWordRows(pool, learner.session.id)).toEqual(
      SESSION_WORDS,
    );
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await wordRows(pool, learner.id)).toEqual([
      expect.objectContaining({ lemma: 'really', times_used: 0 }),
      expect.objectContaining({ lemma: 'went', times_used: 0 }),
    ]);
  });

  it('[TC-05-01] records one set of words and links when a completion runs in parallel with step 2', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const completion = pendingAnalysis.complete(learner.id, learner.session.id);
    const stepTwo = postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    ).then((res) => res);
    try {
      await waitForLockWaiters(pool, 2);
    } finally {
      await holder.release();
    }

    const [, response] = await Promise.all([completion, stepTwo]);

    expect(response.status).toBe(200);
    expect(await sessionWordRows(pool, learner.session.id)).toEqual(
      SESSION_WORDS,
    );
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await wordRows(pool, learner.id)).toEqual([
      expect.objectContaining({ lemma: 'really', times_used: 0 }),
      expect.objectContaining({ lemma: 'went', times_used: 0 }),
    ]);
  });

  it('[TC-05-01] records no words for an answer without better phrasings', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, 'I like football.');

    await analyse(app, learner, utteranceId);

    expect(await sessionWordRows(pool, learner.session.id)).toEqual([]);
    expect(await wordRows(pool, learner.id)).toEqual([]);
  });
});

describe('session words with a failed analysis', () => {
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp({ env: { FAKE_LLM_FAIL: 'invalid_json' } });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  it('[TC-05-01] records no words when the analysis fails', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance.analysisStatus).toBe('failed');
    expect(await sessionWordRows(pool, learner.session.id)).toEqual([]);
    expect(await wordRows(pool, learner.id)).toEqual([]);
  });
});
