import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { SessionDetailsSchema } from '@gototalk/shared';
import type { StartSessionRequest } from '@gototalk/shared';
import pg from 'pg';
import request from 'supertest';
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
import { SessionsService } from '../src/modules/session/sessions.service.js';
import {
  MISSING_USER_ID,
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const QUESTIONS = [
  'What are you doing this weekend?',
  'Who do you usually spend it with?',
  'Where do you like to go?',
  'What did you do last weekend?',
  'What would be your perfect weekend?',
];
const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: QUESTIONS,
} satisfies Omit<StartSessionRequest, 'feedbackMode'>;

interface SessionRow {
  id: string;
  status: string;
  ended_at: Date | null;
  plan: { questions: string[] } | null;
}

describe('POST /api/sessions', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let lockHolder: pg.Client | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  afterEach(async () => {
    const holder = lockHolder;
    lockHolder = undefined;
    if (!holder) return;
    await holder.query('ROLLBACK').catch(() => undefined);
    await holder.end();
  });

  const start = (token: string, body: object = PLAN) =>
    request(app.getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  async function consentedUser() {
    const user = await registerUser(app);
    await grantConsent(app, user.token);
    return user;
  }

  async function startOk(token: string, body: object = PLAN) {
    const res = await start(token, body);
    expect(res.status).toBe(201);
    return SessionDetailsSchema.parse(res.body);
  }

  async function sessionRows(userId: string): Promise<SessionRow[]> {
    const { rows } = await pool.query<SessionRow>(
      'SELECT id, status, ended_at, plan FROM sessions WHERE user_id = $1 ORDER BY started_at, id',
      [userId],
    );
    return rows;
  }

  async function utteranceSeqs(sessionId: string): Promise<number[]> {
    const { rows } = await pool.query<{ seq: number }>(
      'SELECT seq FROM utterances WHERE session_id = $1 ORDER BY seq',
      [sessionId],
    );
    return rows.map((row) => row.seq);
  }

  it('[TC-03-02] returns 403 CONSENT_REQUIRED before consent is given', async () => {
    const { id, token } = await registerUser(app);

    expectError(await start(token), 403, 'CONSENT_REQUIRED');
    expect(await sessionRows(id)).toHaveLength(0);
  });

  it('[TC-03-02] returns 401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sessions')
      .send(PLAN);

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-03-02] returns 401 when the user no longer exists', async () => {
    const res = await start(await tokenOfMissingUser(app));

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-03-02] rejects the service call with Unauthorized when the owner row is missing', async () => {
    await expect(
      app
        .get(SessionsService)
        .start(MISSING_USER_ID, { ...PLAN, feedbackMode: 'immediate' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const { rows } = await pool.query(
      'SELECT 1 FROM sessions WHERE user_id = $1',
      [MISSING_USER_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it('[TC-03-02] starts an active session with the first question as the only utterance', async () => {
    const { id, token } = await consentedUser();

    const details = await startOk(token);

    expect(details).toMatchObject({
      topic: 'Weekend plans',
      topicSource: 'suggested',
      status: 'active',
      endedAt: null,
    });
    expect(details.utterances).toEqual([
      {
        id: expect.any(String),
        seq: 1,
        role: 'assistant',
        text: QUESTIONS[0],
        analysisStatus: 'skipped',
        mistakes: [],
        better: [],
      },
    ]);
    expect(details.planRemaining).toBe(4);
    const rows = await sessionRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(details.id);
    expect(rows[0]?.plan).toEqual({ questions: QUESTIONS });
    expect(await utteranceSeqs(details.id)).toEqual([1]);
  });

  it('[TC-03-02] does not expose the stored plan in the response', async () => {
    const { token } = await consentedUser();

    const res = await start(token);

    expect(res.body).not.toHaveProperty('plan');
  });

  it('[TC-03-02] stores the first question as a skipped assistant row', async () => {
    const { token } = await consentedUser();
    const details = await startOk(token);

    const { rows } = await pool.query<{
      role: string;
      text_verbatim: string;
      analysis_status: string;
    }>(
      'SELECT role, text_verbatim, analysis_status FROM utterances WHERE session_id = $1',
      [details.id],
    );

    expect(rows).toEqual([
      {
        role: 'assistant',
        text_verbatim: QUESTIONS[0],
        analysis_status: 'skipped',
      },
    ]);
  });

  it('[TC-03-05] persists and returns the deferred feedback mode', async () => {
    const { token } = await consentedUser();

    const details = await startOk(token, { ...PLAN, feedbackMode: 'deferred' });

    expect(details.feedbackMode).toBe('deferred');
    const { rows } = await pool.query<{ feedback_mode: string }>(
      'SELECT feedback_mode FROM sessions WHERE id = $1',
      [details.id],
    );
    expect(rows[0]?.feedback_mode).toBe('deferred');
  });

  it('[TC-03-05] defaults the feedback mode to immediate when omitted', async () => {
    const { token } = await consentedUser();

    const details = await startOk(token);

    expect(details.feedbackMode).toBe('immediate');
  });

  it('[TC-03-02] persists a custom topic source', async () => {
    const { token } = await consentedUser();

    const details = await startOk(token, {
      ...PLAN,
      topic: 'My startup',
      topicSource: 'custom',
    });

    expect(details.topicSource).toBe('custom');
    const { rows } = await pool.query<{ topic: string; topic_source: string }>(
      'SELECT topic, topic_source FROM sessions WHERE id = $1',
      [details.id],
    );
    expect(rows[0]).toEqual({ topic: 'My startup', topic_source: 'custom' });
  });

  it('[TC-03-02] finishes the previous active session and keeps exactly one active', async () => {
    const { id, token } = await consentedUser();
    const first = await startOk(token);

    const second = await startOk(token, { ...PLAN, topic: 'My hometown' });

    const rows = await sessionRows(id);
    expect(rows).toHaveLength(2);
    const previous = rows.find((row) => row.id === first.id);
    expect(previous?.status).toBe('finished');
    expect(previous?.ended_at).not.toBeNull();
    const active = rows.filter((row) => row.status === 'active');
    expect(active.map((row) => row.id)).toEqual([second.id]);
    expect(await utteranceSeqs(first.id)).toEqual([1]);
    expect(await utteranceSeqs(second.id)).toEqual([1]);
  });

  it('[TC-03-02] leaves the active session of another user untouched', async () => {
    const other = await consentedUser();
    const otherSession = await startOk(other.token);
    const { token } = await consentedUser();

    await startOk(token);

    const rows = await sessionRows(other.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: otherSession.id, status: 'active' });
    expect(rows[0]?.ended_at).toBeNull();
  });

  it('[TC-03-02] parallel starts all succeed and leave exactly one active session', async () => {
    const { id, token } = await consentedUser();

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        start(token, { ...PLAN, topic: `Topic ${index}` }),
      ),
    );

    expect(responses.map((res) => res.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    const rows = await sessionRows(id);
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.status === 'active')).toHaveLength(1);
    const { rows: counts } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n
         FROM utterances u JOIN sessions s ON s.id = u.session_id
        WHERE s.user_id = $1 GROUP BY u.session_id`,
      [id],
    );
    expect(counts.map((row) => Number(row.n))).toEqual([1, 1, 1, 1, 1]);
    const { rows: ordering } = await pool.query<{
      ended_after_started: boolean;
      active_is_latest: boolean;
    }>(
      `SELECT bool_and(ended_at >= started_at) FILTER (WHERE status = 'finished') AS ended_after_started,
              bool_and(started_at <= (SELECT started_at FROM sessions WHERE user_id = $1 AND status = 'active')) AS active_is_latest
         FROM sessions WHERE user_id = $1`,
      [id],
    );
    expect(ordering[0]).toEqual({
      ended_after_started: true,
      active_is_latest: true,
    });
  });

  it('[TC-03-02] a start blocks on the user row lock and completes once it is released', async () => {
    const { id, token } = await consentedUser();
    const holder = new pg.Client(pool.options);
    lockHolder = holder;
    await holder.connect();
    await holder.query('BEGIN');
    await holder.query(
      'SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE',
      [id],
    );
    const {
      rows: [holderBackend],
    } = await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');

    let settled = false;
    const pending = start(token).then((res) => {
      settled = true;
      return res;
    });

    await vi.waitFor(
      async () => {
        const { rows } = await pool.query<{ waiting: number }>(
          `SELECT count(*)::int AS waiting FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> $1`,
          [holderBackend?.pid],
        );
        expect(rows[0]?.waiting).toBeGreaterThan(0);
      },
      { timeout: 5000, interval: 25 },
    );
    expect(settled).toBe(false);
    expect(await sessionRows(id)).toHaveLength(0);

    await holder.query('COMMIT');
    const res = await pending;

    expect(res.status).toBe(201);
    expect(SessionDetailsSchema.parse(res.body).status).toBe('active');
    expect(await sessionRows(id)).toHaveLength(1);
  });

  it.each([
    ['four questions', { ...PLAN, questions: QUESTIONS.slice(0, 4) }],
    ['six questions', { ...PLAN, questions: [...QUESTIONS, 'One more?'] }],
    ['an unknown feedback mode', { ...PLAN, feedbackMode: 'later' }],
    ['an empty topic', { ...PLAN, topic: '   ' }],
    ['an unknown topic source', { ...PLAN, topicSource: 'random' }],
    ['a missing topic', { topicSource: 'suggested', questions: QUESTIONS }],
  ])('[TC-03-02] rejects %s with 400 VALIDATION_ERROR', async (_, body) => {
    const { id, token } = await consentedUser();

    expectError(await start(token, body), 400, 'VALIDATION_ERROR');
    expect(await sessionRows(id)).toHaveLength(0);
  });
});
