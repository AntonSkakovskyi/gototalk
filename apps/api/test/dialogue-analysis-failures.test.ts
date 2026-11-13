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
import type { LanguageModelPort } from '../src/integrations/language-model/language-model.port.js';
import { expectError } from './support/api-client.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  PLAN,
  analyse,
  fetchDetails,
  mistakeRows,
  patternRows,
  postAnalysis,
  startLearner,
  submitAnswer,
  utteranceRows,
} from './support/dialogue-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const SENTINEL = 'SENTINEL-answer-text-do-not-log';
const SENSITIVE_ANSWER = `Yesterday I go home. ${SENTINEL}`;

describe('step 2 with the Fake invalid_json mode', () => {
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

  it('[TC-04-02] stores a failed analysis without mistakes and still returns the reply', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance).toMatchObject({
      analysisStatus: 'failed',
      mistakes: [],
      better: [],
    });
    expect(result.reply?.text).toBe(PLAN.questions[1]);
    const [, stored] = await utteranceRows(pool, learner.session.id);
    expect(stored).toMatchObject({
      analysis_status: 'failed',
      analysis_prompt_version: 'error-analysis.v1',
      analysis_model: 'fake',
    });
    expect(stored?.analyzed_at).not.toBeNull();
    expect(await mistakeRows(pool, utteranceId)).toEqual([]);
    expect(await patternRows(pool, learner.id)).toEqual([]);
  });

  it('[TC-04-02] does not run a failed analysis again on a repeat call', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const first = await analyse(app, learner, utteranceId);
    const analyzeSpy = vi.spyOn(
      app.get<LanguageModelPort>(LANGUAGE_MODEL_PORT),
      'analyzeUtterance',
    );

    const second = await analyse(app, learner, utteranceId);

    expect(second).toEqual(first);
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(3);
  });
});

describe('step 2 when the language model fails', () => {
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

  function spyOnLogs() {
    return (['log', 'warn', 'error', 'debug', 'verbose'] as const).map(
      (method) => vi.spyOn(Logger.prototype, method),
    );
  }

  it('[TC-04-08] answers 503, leaves the answer pending and does not log or return its text', async () => {
    const logs = spyOnLogs();
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, SENSITIVE_ANSWER);
    model.analysisUnavailable = true;
    model.nextTurnUnavailable = true;

    const res = await postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    );

    expectError(res, 503, 'LANGUAGE_MODEL_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain(SENTINEL);
    expect(JSON.stringify(logs.map((spy) => spy.mock.calls))).not.toContain(
      SENTINEL,
    );
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.analysis_status)).toEqual([
      'skipped',
      'pending',
    ]);
    expect(await fetchDetails(app, learner)).toMatchObject({
      status: 'active',
    });
  });

  it('[TC-04-08] completes the analysis and the reply on a repeat call after the model recovers', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    model.analysisUnavailable = true;
    model.nextTurnUnavailable = true;
    await postAnalysis(app, learner.token, learner.session.id, utteranceId);
    model.recover();

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance.analysisStatus).toBe('done');
    expect(result.utterance.mistakes).toHaveLength(2);
    expect(result.reply?.text).toBe(PLAN.questions[1]);
  });

  it('[TC-04-08] stores the reply when only the analysis is unavailable and the analysis on the retry', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    model.analysisUnavailable = true;

    const res = await postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    );

    expectError(res, 503, 'LANGUAGE_MODEL_UNAVAILABLE');
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => [row.role, row.analysis_status])).toEqual([
      ['assistant', 'skipped'],
      ['user', 'pending'],
      ['assistant', 'skipped'],
    ]);
    model.reset();

    const retry = await analyse(app, learner, utteranceId);

    expect(retry.utterance.analysisStatus).toBe('done');
    expect(retry.reply?.text).toBe(PLAN.questions[1]);
    expect(model.calls.nextTurn).toBe(0);
    expect(await utteranceRows(pool, learner.session.id)).toHaveLength(3);
  });

  it('[TC-04-08] answers 502 for an invalid next turn, keeps the analysis and retries only the reply', async () => {
    const logs = spyOnLogs();
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(
      app,
      learner,
      `${MISTAKEN_ANSWER} ${SENTINEL}`,
    );
    model.nextTurnInvalid = true;

    const res = await postAnalysis(
      app,
      learner.token,
      learner.session.id,
      utteranceId,
    );

    expectError(res, 502, 'LANGUAGE_MODEL_INVALID_RESPONSE');
    expect(JSON.stringify(res.body)).not.toContain(SENTINEL);
    expect(JSON.stringify(logs.map((spy) => spy.mock.calls))).not.toContain(
      SENTINEL,
    );
    expect(model.calls.nextTurn).toBe(2);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.analysis_status)).toEqual(['skipped', 'done']);
    expect(await patternRows(pool, learner.id)).toHaveLength(2);
    model.recover();

    const retry = await analyse(app, learner, utteranceId);

    expect(retry.reply?.text).toBe(PLAN.questions[1]);
    expect(model.calls.analyze).toBe(1);
    expect(await patternRows(pool, learner.id)).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
  });
});
