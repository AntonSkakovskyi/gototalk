import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
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
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  PLAN,
  analyse,
  fetchDetails,
  mistakeRows,
  patternRows,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

function isQueryConfig(value: unknown): value is { text: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'text' in value &&
    typeof value.text === 'string'
  );
}

describe('POST /api/sessions/:id/utterances/:utteranceId/analysis', () => {
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

  it('[TC-04-02] stores the analysis, asks the first remaining plan question and shows both in the session', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance).toMatchObject({
      id: utteranceId,
      seq: 2,
      role: 'user',
      text: MISTAKEN_ANSWER,
      analysisStatus: 'done',
    });
    expect(result.utterance.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    for (const mistake of result.utterance.mistakes) {
      expect(MISTAKEN_ANSWER.slice(mistake.start, mistake.end)).toBe(
        mistake.original,
      );
    }
    expect(result.utterance.better).toHaveLength(2);
    expect(result.reply).toMatchObject({
      seq: 3,
      role: 'assistant',
      text: PLAN.questions[1],
      analysisStatus: 'skipped',
      mistakes: [],
      better: [],
    });
    expect(result.planRemaining).toBe(learner.session.planRemaining - 1);
    expect(await fetchDetails(app, learner)).toMatchObject({
      utterances: [expect.anything(), result.utterance, result.reply],
      planRemaining: result.planRemaining,
    });
  });

  it('[TC-04-02] stores mistakes with exact positions, analysis metadata and the pattern counters', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const result = await analyse(app, learner, utteranceId);

    const [, stored] = await utteranceRows(pool, learner.session.id);
    expect(stored).toMatchObject({
      text_verbatim: MISTAKEN_ANSWER,
      analysis_status: 'done',
      analysis_prompt_version: 'error-analysis.v1',
      analysis_model: 'fake',
      better_phrasings: result.utterance.better,
    });
    expect(stored?.analyzed_at).not.toBeNull();
    const mistakes = await mistakeRows(pool, utteranceId);
    expect(mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    for (const row of mistakes) {
      expect(MISTAKEN_ANSWER.slice(row.start_pos, row.end_pos)).toBe(
        row.original,
      );
    }
    const patterns = await patternRows(pool, learner.id);
    expect(patterns).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
    expect(patterns.every((p) => p.last_seen_at !== null)).toBe(true);
    expect(mistakes.map((m) => m.pattern_id)).toEqual(
      patterns.map((p) => p.id),
    );
  });

  it('[TC-04-02] accumulates the pattern frequency across answers and keeps the plan order', async () => {
    const learner = await startLearner(app);
    await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );

    const second = await submitAnswer(
      app,
      learner,
      'Last week I meet my friends.',
    );
    const result = await analyse(app, learner, second);

    expect(result.utterance.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
    ]);
    expect(result.reply?.text).toBe(PLAN.questions[2]);
    expect(result.planRemaining).toBe(learner.session.planRemaining - 2);
    const patterns = await patternRows(pool, learner.id);
    expect(patterns).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 2 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
  });

  it('[TC-04-02] stores no mistakes and no pattern change for a correct answer', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, 'I like football.');

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance.mistakes).toEqual([]);
    expect(result.utterance.better).toEqual([]);
    expect(model.calls).toEqual({
      analyze: 1,
      nextTurn: 1,
      hint: 0,
      summarize: 0,
    });
    expect(await mistakeRows(pool, utteranceId)).toEqual([]);
    expect(await patternRows(pool, learner.id)).toEqual([]);
  });

  it('[TC-04-02] upserts the pattern categories in alphabetical order whatever the order of the mistakes', async () => {
    const querySpy = vi.spyOn(pg.Client.prototype, 'query');
    const learner = await startLearner(app);
    const answer = 'I very like my job. Yesterday I go to the office.';
    const utteranceId = await submitAnswer(app, learner, answer);

    const result = await analyse(app, learner, utteranceId);

    expect(result.utterance.mistakes.map((m) => m.category)).toEqual([
      'word_order',
      'verb_tense',
    ]);
    const calls: unknown[][] = querySpy.mock.calls;
    const upserts = calls.flatMap(([config, values]) =>
      isQueryConfig(config) &&
      config.text.startsWith('insert into "mistake_patterns"')
        ? [values]
        : [],
    );
    expect(upserts).toHaveLength(1);
    expect(
      Array.isArray(upserts[0])
        ? upserts[0].filter(
            (value) => value === 'verb_tense' || value === 'word_order',
          )
        : upserts[0],
    ).toEqual(['verb_tense', 'word_order']);
  });
});
