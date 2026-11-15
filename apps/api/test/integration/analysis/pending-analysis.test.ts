import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import { PendingAnalysisService } from '../../../src/modules/analysis/pending-analysis.service.js';
import { ControllableLanguageModel } from '../../support/controllable-language-model.js';
import {
  MISTAKEN_ANSWER,
  countMistakes,
  mistakeRows,
  patternRows,
  postAnalysis,
  startLearner,
  submitAnswer,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import {
  SessionLockHolder,
  waitForLockWaiters,
} from '../../support/session-lock.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

// The API refuses a second answer before the first is analysed, so the extra pending row is seeded
async function insertPendingAnswer(
  pool: pg.Pool,
  sessionId: string,
  seq: number,
  text: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO utterances (session_id, seq, role, text_verbatim, analysis_status)
     VALUES ($1, $2, 'user', $3, 'pending') RETURNING id`,
    [sessionId, seq, text],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Expected an inserted utterance');
  return id;
}

describe('completing pending analyses', () => {
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

  it('[TC-05-02] analyses a pending answer and records its mistakes and pattern frequencies', async () => {
    const learner = await startLearner(app);
    const utteranceId = await submitAnswer(app, learner, MISTAKEN_ANSWER);

    const complete = await pendingAnalysis.complete(
      learner.id,
      learner.session.id,
    );

    expect(complete).toBe(true);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.analysis_status)).toEqual(['skipped', 'done']);
    expect(rows[1]).toMatchObject({
      id: utteranceId,
      analysis_prompt_version: expect.any(String),
      analysis_model: expect.any(String),
      analyzed_at: expect.anything(),
    });
    expect(await mistakeRows(pool, utteranceId)).toHaveLength(2);
    const patterns = await patternRows(pool, learner.id);
    expect(patterns).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
    expect(patterns.every((row) => row.last_seen_at !== null)).toBe(true);
  });

  it('[TC-05-02] leaves answers pending and returns false while the model is unavailable, then finishes after recovery', async () => {
    const learner = await startLearner(app);
    const first = await submitAnswer(app, learner, MISTAKEN_ANSWER);
    const second = await insertPendingAnswer(
      pool,
      learner.session.id,
      3,
      'I like football.',
    );
    model.analysisUnavailable = true;

    const failed = await pendingAnalysis.complete(
      learner.id,
      learner.session.id,
    );

    expect(failed).toBe(false);
    expect(model.calls.analyze).toBe(1);
    const stuck = await utteranceRows(pool, learner.session.id);
    expect(
      stuck
        .filter((row) => row.role === 'user')
        .map((row) => row.analysis_status),
    ).toEqual(['pending', 'pending']);
    expect(await countMistakes(pool, learner.session.id)).toBe(0);
    expect(await patternRows(pool, learner.id)).toEqual([]);

    model.recover();
    const recovered = await pendingAnalysis.complete(
      learner.id,
      learner.session.id,
    );

    expect(recovered).toBe(true);
    const done = await utteranceRows(pool, learner.session.id);
    expect(done.find((row) => row.id === first)?.analysis_status).toBe('done');
    expect(done.find((row) => row.id === second)?.analysis_status).toBe('done');
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
  });

  it('[TC-05-02] analyses a finished session without asking for another question', async () => {
    const learner = await startLearner(app);
    await submitAnswer(app, learner, MISTAKEN_ANSWER);
    await pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );

    const complete = await pendingAnalysis.complete(
      learner.id,
      learner.session.id,
    );

    expect(complete).toBe(true);
    expect(model.calls).toMatchObject({ analyze: 1, nextTurn: 0 });
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => [row.seq, row.analysis_status])).toEqual([
      [1, 'skipped'],
      [2, 'done'],
    ]);
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
  });

  it('[TC-05-02] does not call the model when nothing is pending', async () => {
    const learner = await startLearner(app);

    await expect(
      pendingAnalysis.complete(learner.id, learner.session.id),
    ).resolves.toBe(true);

    expect(model.calls.analyze).toBe(0);
  });

  it('[TC-05-02] does not analyse an answer whose analysis already failed', async () => {
    const learner = await startLearner(app);
    await submitAnswer(app, learner, MISTAKEN_ANSWER);
    await pool.query(
      `UPDATE utterances SET analysis_status = 'failed'
       WHERE session_id = $1 AND role = 'user'`,
      [learner.session.id],
    );

    await expect(
      pendingAnalysis.complete(learner.id, learner.session.id),
    ).resolves.toBe(true);

    expect(model.calls.analyze).toBe(0);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.at(-1)?.analysis_status).toBe('failed');
  });

  it('[TC-05-02] stores one set of mistakes when two completions run in parallel', async () => {
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
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await patternRows(pool, learner.id)).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
  });

  it('[TC-05-02] stores one set of mistakes when a completion runs in parallel with step 2', async () => {
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

    const [complete, response] = await Promise.all([completion, stepTwo]);

    expect(complete).toBe(true);
    expect(response.status).toBe(200);
    expect(await countMistakes(pool, learner.session.id)).toBe(2);
    expect(await patternRows(pool, learner.id)).toEqual([
      expect.objectContaining({ category: 'verb_tense', frequency: 1 }),
      expect.objectContaining({ category: 'word_order', frequency: 1 }),
    ]);
    const rows = await utteranceRows(pool, learner.session.id);
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
  });

  it('[TC-05-02] touches nothing in a session of another user', async () => {
    const owner = await startLearner(app);
    const stranger = await startLearner(app);
    await submitAnswer(app, owner, MISTAKEN_ANSWER);

    const complete = await pendingAnalysis.complete(
      stranger.id,
      owner.session.id,
    );

    expect(complete).toBe(true);
    expect(model.calls.analyze).toBe(0);
    const rows = await utteranceRows(pool, owner.session.id);
    expect(rows.at(-1)?.analysis_status).toBe('pending');
    expect(await patternRows(pool, owner.id)).toEqual([]);
    expect(await patternRows(pool, stranger.id)).toEqual([]);
  });
});
