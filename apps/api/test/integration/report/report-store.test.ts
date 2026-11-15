import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../../../src/core/db/db.tokens.js';
import type { Database } from '../../../src/core/db/db.tokens.js';
import { ReportRepository } from '../../../src/modules/report/persistence/report.repository.js';
import { registerUser } from '../../support/api-client.js';
import { REPORT_STARTED_AT } from '../../support/report-fixtures.js';
import { insertFinished } from '../../support/session-fixtures.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

interface ReportRow {
  summary: string;
  prompt_version: string | null;
  model: string | null;
  deep_analysis: unknown;
}

describe('report summary store', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let repository: ReportRepository;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    repository = new ReportRepository(app.get<Database>(DRIZZLE));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function learnerSession(): Promise<{
    userId: string;
    sessionId: string;
  }> {
    const { id: userId } = await registerUser(app);
    const sessionId = await insertFinished(
      pool,
      userId,
      'Topic',
      REPORT_STARTED_AT,
    );
    return { userId, sessionId };
  }

  async function reportRows(sessionId: string): Promise<ReportRow[]> {
    const { rows } = await pool.query<ReportRow>(
      `SELECT summary, prompt_version, model, deep_analysis
         FROM session_reports WHERE session_id = $1`,
      [sessionId],
    );
    return rows;
  }

  const stored = (summary: string, model = 'fake') => ({
    summary,
    promptVersion: 'session-summary.v1',
    model,
  });

  it('[TC-05-02] stores the summary with its prompt version and model', async () => {
    const { userId, sessionId } = await learnerSession();

    await repository.saveSummary(userId, sessionId, stored('First'));

    expect(await reportRows(sessionId)).toEqual([
      {
        summary: 'First',
        prompt_version: 'session-summary.v1',
        model: 'fake',
        deep_analysis: null,
      },
    ]);
    expect(await repository.findStoredSummary(userId, sessionId)).toEqual({
      summary: 'First',
      promptVersion: 'session-summary.v1',
      model: 'fake',
    });
  });

  it('[TC-05-02] keeps the first summary when it is saved twice', async () => {
    const { userId, sessionId } = await learnerSession();

    await repository.saveSummary(userId, sessionId, stored('First', 'model-a'));
    await repository.saveSummary(
      userId,
      sessionId,
      stored('Second', 'model-b'),
    );

    expect(await reportRows(sessionId)).toEqual([
      expect.objectContaining({ summary: 'First', model: 'model-a' }),
    ]);
  });

  it('[TC-05-02] stores one row when two saves run in parallel', async () => {
    const { userId, sessionId } = await learnerSession();

    await Promise.all([
      repository.saveSummary(userId, sessionId, stored('A')),
      repository.saveSummary(userId, sessionId, stored('B')),
    ]);

    expect(await reportRows(sessionId)).toHaveLength(1);
  });

  it('[TC-05-02] stores nothing for a session of another user', async () => {
    const { sessionId } = await learnerSession();
    const { id: strangerId } = await registerUser(app);

    await repository.saveSummary(strangerId, sessionId, stored('Foreign'));

    expect(await reportRows(sessionId)).toEqual([]);
  });

  it('[TC-05-02] deletes the summary together with the session', async () => {
    const { userId, sessionId } = await learnerSession();
    await repository.saveSummary(userId, sessionId, stored('First'));

    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);

    expect(await reportRows(sessionId)).toEqual([]);
  });
});
