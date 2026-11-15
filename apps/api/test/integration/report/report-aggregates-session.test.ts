import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../../../src/core/db/db.tokens.js';
import type { Database } from '../../../src/core/db/db.tokens.js';
import { ReportRepository } from '../../../src/modules/report/persistence/report.repository.js';
import { MISSING_USER_ID, registerUser } from '../../support/api-client.js';
import {
  REPORT_STARTED_AT,
  insertLinkedWord,
  setUtteranceCreatedAt,
} from '../../support/report-fixtures.js';
import {
  insertFinished,
  insertUtterance,
} from '../../support/session-fixtures.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('report session aggregates in SQL', () => {
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

  it('[TC-05-01] finds an owned session with its status and start', async () => {
    const { userId, sessionId } = await learnerSession();

    expect(await repository.findOwnedSession(userId, sessionId)).toEqual({
      id: sessionId,
      status: 'finished',
      startedAt: new Date(REPORT_STARTED_AT),
    });
  });

  it('[TC-05-01] returns null for a foreign or missing session', async () => {
    const { userId, sessionId } = await learnerSession();
    const { id: strangerId } = await registerUser(app);

    expect(await repository.findOwnedSession(strangerId, sessionId)).toBeNull();
    expect(
      await repository.findOwnedSession(userId, MISSING_USER_ID),
    ).toBeNull();
  });

  it('[TC-05-01] counts user answers and measures whole seconds up to the last answer', async () => {
    const { userId, sessionId } = await learnerSession();
    const first = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    const assistant = await insertUtterance(
      pool,
      sessionId,
      2,
      'assistant',
      'q',
    );
    const last = await insertUtterance(pool, sessionId, 3, 'user', 'two');
    await setUtteranceCreatedAt(pool, first, '2026-11-10T10:01:00Z');
    await setUtteranceCreatedAt(pool, assistant, '2026-11-10T10:09:00Z');
    await setUtteranceCreatedAt(pool, last, '2026-11-10T10:02:30.900Z');

    expect(await repository.stats(userId, sessionId)).toEqual({
      answers: 2,
      durationSeconds: 150,
    });
  });

  it('[TC-05-01] reports no stats or stored summary for a foreign session', async () => {
    const { sessionId } = await learnerSession();
    const { id: strangerId } = await registerUser(app);
    await insertUtterance(pool, sessionId, 1, 'user', 'one');
    await pool.query(
      `INSERT INTO session_reports (session_id, summary, prompt_version, model)
       VALUES ($1, 'Stored text', 'session-summary.v1', 'fake')`,
      [sessionId],
    );

    expect(await repository.stats(strangerId, sessionId)).toEqual({
      answers: 0,
      durationSeconds: 0,
    });
    expect(
      await repository.findStoredSummary(strangerId, sessionId),
    ).toBeNull();
  });

  it('[TC-05-01] reports zero answers and zero duration for a session with only assistant turns', async () => {
    const { userId, sessionId } = await learnerSession();
    await insertUtterance(pool, sessionId, 1, 'assistant', 'q');

    expect(await repository.stats(userId, sessionId)).toEqual({
      answers: 0,
      durationSeconds: 0,
    });
  });

  it('[TC-05-01] never reports a negative duration', async () => {
    const { userId, sessionId } = await learnerSession();
    const answer = await insertUtterance(pool, sessionId, 1, 'user', 'one');
    await setUtteranceCreatedAt(pool, answer, '2026-11-10T09:00:00Z');

    expect(await repository.stats(userId, sessionId)).toEqual({
      answers: 1,
      durationSeconds: 0,
    });
  });

  it('[TC-05-01] returns only the words linked to this session, in the word shape, oldest first', async () => {
    const { userId, sessionId } = await learnerSession();
    const otherSessionId = await insertFinished(
      pool,
      userId,
      'Other',
      '2026-11-09T10:00:00Z',
    );
    const later = await insertLinkedWord(
      pool,
      userId,
      'later',
      '2026-11-10T10:05:00Z',
      sessionId,
    );
    const earlier = await insertLinkedWord(
      pool,
      userId,
      'earlier',
      '2026-11-10T10:01:00Z',
      sessionId,
    );
    await insertLinkedWord(
      pool,
      userId,
      'elsewhere',
      '2026-11-10T10:02:00Z',
      otherSessionId,
    );
    await insertLinkedWord(pool, userId, 'unlinked', '2026-11-10T10:03:00Z');

    expect(await repository.sessionWords(userId, sessionId)).toEqual([
      {
        id: earlier,
        lemma: 'earlier',
        translationUk: 'earlier-uk',
        state: 'partial',
        source: 'hint',
      },
      {
        id: later,
        lemma: 'later',
        translationUk: 'later-uk',
        state: 'partial',
        source: 'hint',
      },
    ]);
  });

  it('[TC-05-01] excludes words of another user and returns nothing to a foreign requester', async () => {
    const { userId, sessionId } = await learnerSession();
    const { id: strangerId } = await registerUser(app);
    await insertLinkedWord(
      pool,
      strangerId,
      'stranger',
      '2026-11-10T10:01:00Z',
      sessionId,
    );
    await insertLinkedWord(
      pool,
      userId,
      'mine',
      '2026-11-10T10:02:00Z',
      sessionId,
    );

    const own = await repository.sessionWords(userId, sessionId);
    expect(own.map((word) => word.lemma)).toEqual(['mine']);
    expect(await repository.sessionWords(strangerId, sessionId)).toEqual([]);
  });

  it('[TC-05-02] returns null without a stored report and the stored summary with its prompt version and model', async () => {
    const { userId, sessionId } = await learnerSession();
    expect(await repository.findStoredSummary(userId, sessionId)).toBeNull();

    await pool.query(
      `INSERT INTO session_reports (session_id, summary, prompt_version, model)
       VALUES ($1, 'Stored text', 'session-summary.v1', 'fake')`,
      [sessionId],
    );

    expect(await repository.findStoredSummary(userId, sessionId)).toEqual({
      summary: 'Stored text',
      promptVersion: 'session-summary.v1',
      model: 'fake',
    });
  });
});
