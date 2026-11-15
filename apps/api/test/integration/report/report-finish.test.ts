import type { INestApplication } from '@nestjs/common';
import { SessionReportSchema } from '@gototalk/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  analyse,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import {
  finishSession,
  finishedLearner,
  getReport,
  startNextSession,
} from '../../support/report-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiters,
} from '../../support/session-lock.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

interface ReportRow {
  summary: string;
  prompt_version: string | null;
  model: string | null;
}

describe('report generation on finish', () => {
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

  async function reportRows(sessionId: string): Promise<ReportRow[]> {
    const { rows } = await pool.query<ReportRow>(
      'SELECT summary, prompt_version, model FROM session_reports WHERE session_id = $1',
      [sessionId],
    );
    return rows;
  }

  async function endedAt(sessionId: string): Promise<string> {
    const { rows } = await pool.query<{ ended_at: Date }>(
      'SELECT ended_at FROM sessions WHERE id = $1',
      [sessionId],
    );
    return rows[0]?.ended_at.toISOString() ?? '';
  }

  it('[TC-05-02] stores exactly one report with the prompt version and model when the session is finished', async () => {
    const learner = await finishedLearner(app);

    const rows = await reportRows(learner.session.id);

    expect(rows).toEqual([
      {
        summary: expect.stringMatching(/^Ви відповіли 1 /),
        prompt_version: 'session-summary.v1',
        model: 'fake',
      },
    ]);
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-02] keeps one report, the ended_at and the call count on a repeated finish', async () => {
    const learner = await finishedLearner(app);
    const ended = await endedAt(learner.session.id);

    await finishSession(app, learner);

    expect(await reportRows(learner.session.id)).toHaveLength(1);
    expect(await endedAt(learner.session.id)).toBe(ended);
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-02] creates no report and makes no model call for a session without answers', async () => {
    const learner = await finishedLearner(app, []);

    expect(await reportRows(learner.session.id)).toEqual([]);
    expect(model.calls.summarize).toBe(0);
  });

  it('[TC-05-02] analyses a pending answer during finish and counts its mistakes in the report', async () => {
    const learner = await startLearner(app);
    await submitAnswer(app, learner, MISTAKEN_ANSWER);

    await finishSession(app, learner);

    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.analysis_status)).toEqual(['skipped', 'done']);
    const res = await getReport(app, learner.token, learner.session.id);
    const report = SessionReportSchema.parse(res.body);
    expect(report.categories.map((item) => item.category)).toContain(
      'verb_tense',
    );
    expect(report.summary.status).toBe('ready');
    expect(await reportRows(learner.session.id)).toHaveLength(1);
    expect(model.calls.summarize).toBe(1);
  });

  it('[TC-05-02] returns one report for a finish and a report read racing on the session lock', async () => {
    const learner = await startLearner(app);
    await analyse(
      app,
      learner,
      await submitAnswer(app, learner, MISTAKEN_ANSWER),
    );
    await startNextSession(app, learner.token);
    const holder = await SessionLockHolder.acquire(pool, learner.session.id);

    const finishing = finishSession(app, learner);
    const reading = getReport(app, learner.token, learner.session.id).then(
      (res) => res,
    );
    try {
      await waitForLockWaiters(pool, 2);
    } finally {
      await holder.release();
    }
    const [, res] = await Promise.all([finishing, reading]);
    const after = await getReport(app, learner.token, learner.session.id);

    expect(res.status).toBe(200);
    const report = SessionReportSchema.parse(res.body);
    expect(report.summary.status).toBe('ready');
    expect(SessionReportSchema.parse(after.body)).toEqual(report);
    expect(await reportRows(learner.session.id)).toHaveLength(1);
  });
});
