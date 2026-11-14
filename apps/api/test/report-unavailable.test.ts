import type { INestApplication } from '@nestjs/common';
import { SessionReportSchema } from '@gototalk/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from './support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  analyse,
  fetchDetails,
  startLearner,
  submitAnswer,
} from './support/dialogue-flow.js';
import { postHint } from './support/hints-flow.js';
import {
  finishSession,
  finishedLearner,
  getReport,
} from './support/report-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('report with an unavailable summary', () => {
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

  async function reportCount(sessionId: string): Promise<number> {
    const { rows } = await pool.query(
      'SELECT 1 FROM session_reports WHERE session_id = $1',
      [sessionId],
    );
    return rows.length;
  }

  async function readReport(token: string, sessionId: string) {
    const res = await getReport(app, token, sessionId);
    expect(res.status).toBe(200);
    return SessionReportSchema.parse(res.body);
  }

  it('[TC-05-02] finishes with 200 and no report row, then serves the aggregates with an unavailable summary', async () => {
    model.summaryUnavailable = true;
    const learner = await startLearner(app);
    await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );
    const hint = await postHint(app, learner.token, learner.session.id, {
      kind: 'translation',
      word: 'зустріч',
    });
    expect(hint.status).toBe(200);

    await finishSession(app, learner);
    const report = await readReport(learner.token, learner.session.id);

    expect((await fetchDetails(app, learner)).status).toBe('finished');
    expect(report.summary).toEqual({ status: 'unavailable' });
    expect(report.answers).toBe(1);
    expect(report.categories.length).toBeGreaterThan(0);
    expect(report.words.length).toBeGreaterThan(0);
    expect(await reportCount(learner.session.id)).toBe(0);
  });

  it('[TC-05-02] generates the summary on a later read once the model recovers', async () => {
    model.summaryUnavailable = true;
    const learner = await finishedLearner(app);
    const unavailable = await readReport(learner.token, learner.session.id);
    expect(unavailable.summary).toEqual({ status: 'unavailable' });

    model.recover();
    const report = await readReport(learner.token, learner.session.id);

    expect(report.summary.status).toBe('ready');
    expect(await reportCount(learner.session.id)).toBe(1);
  });

  it('[TC-05-02] treats an invalid summary as unavailable after one retry and stores nothing', async () => {
    model.summaryOutput = { summary: 123 };

    const learner = await finishedLearner(app);

    expect(model.calls.summarize).toBe(2);
    expect(await reportCount(learner.session.id)).toBe(0);
    model.calls.summarize = 0;
    const report = await readReport(learner.token, learner.session.id);
    expect(report.summary).toEqual({ status: 'unavailable' });
    expect(model.calls.summarize).toBe(2);
    expect(await reportCount(learner.session.id)).toBe(0);
  });

  it('[TC-05-02] keeps a pending answer pending and the report unavailable while the model is down', async () => {
    model.analysisUnavailable = true;
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await finishSession(app, learner);
    const report = await readReport(learner.token, learner.session.id);

    const details = await fetchDetails(app, learner);
    expect(
      details.utterances.find((utterance) => utterance.id === utteranceId)
        ?.analysisStatus,
    ).toBe('pending');
    expect(report.summary).toEqual({ status: 'unavailable' });
    expect(model.calls.summarize).toBe(0);
    expect(await reportCount(learner.session.id)).toBe(0);
  });
});
