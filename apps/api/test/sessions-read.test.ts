import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  RECENT_SESSIONS_LIMIT,
  SessionDetailsSchema,
  SessionListSchema,
} from '@gototalk/shared';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import {
  expectError,
  grantConsent,
  registerUser,
  tokenOfMissingUser,
} from './support/api-client.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
};

describe('GET /api/sessions and GET /api/sessions/:id', () => {
  let app: INestApplication;
  let pool: pg.Pool;

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

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  async function insertFinished(
    userId: string,
    topic: string,
    startedAt: string,
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO sessions (user_id, topic, status, started_at, ended_at, plan)
       VALUES ($1, $2, 'finished', $3, $3::timestamptz + interval '5 minutes', $4)
       RETURNING id`,
      [userId, topic, startedAt, JSON.stringify({ questions: ['q'] })],
    );
    const row = rows[0];
    if (!row) throw new Error('Session insert returned no row');
    return row.id;
  }

  async function list(token: string) {
    const res = await get('/api/sessions', token);
    expect(res.status).toBe(200);
    return SessionListSchema.parse(res.body);
  }

  it('[TC-03-02] lists the sessions newest first', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'a', '2026-01-01T10:00:00Z');
    await insertFinished(id, 'c', '2026-03-01T10:00:00Z');
    await insertFinished(id, 'b', '2026-02-01T10:00:00Z');

    const sessions = await list(token);

    expect(sessions.map((session) => session.topic)).toEqual(['c', 'b', 'a']);
  });

  it('[TC-03-02] breaks started_at ties by id descending', async () => {
    const { id, token } = await registerUser(app);
    const ids = [
      await insertFinished(id, 'one', '2026-01-01T10:00:00Z'),
      await insertFinished(id, 'two', '2026-01-01T10:00:00Z'),
    ];

    const sessions = await list(token);

    expect(sessions.map((session) => session.id)).toEqual(ids.sort().reverse());
  });

  it('[TC-03-02] returns at most RECENT_SESSIONS_LIMIT sessions, the newest ones', async () => {
    const { id, token } = await registerUser(app);
    const total = RECENT_SESSIONS_LIMIT + 2;
    for (let day = 1; day <= total; day += 1) {
      const date = `2026-01-${String(day).padStart(2, '0')}T10:00:00Z`;
      await insertFinished(id, `day ${day}`, date);
    }

    const sessions = await list(token);

    expect(sessions).toHaveLength(RECENT_SESSIONS_LIMIT);
    expect(sessions[0]?.topic).toBe(`day ${total}`);
    expect(sessions.at(-1)?.topic).toBe(
      `day ${total - RECENT_SESSIONS_LIMIT + 1}`,
    );
  });

  it('[TC-03-02] lists only the sessions of the caller', async () => {
    const mine = await registerUser(app);
    const other = await registerUser(app);
    await insertFinished(mine.id, 'mine', '2026-01-01T10:00:00Z');
    await insertFinished(other.id, 'theirs', '2026-02-01T10:00:00Z');

    const sessions = await list(mine.token);

    expect(sessions.map((session) => session.topic)).toEqual(['mine']);
  });

  it('[TC-03-02] returns an empty list for a user without sessions', async () => {
    const { token } = await registerUser(app);

    expect(await list(token)).toEqual([]);
  });

  it('[TC-03-02] lets a user without consent read the list and the details', async () => {
    const { id, token } = await registerUser(app);
    const sessionId = await insertFinished(
      id,
      'read me',
      '2026-01-01T10:00:00Z',
    );

    expect(await list(token)).toHaveLength(1);
    expect((await get(`/api/sessions/${sessionId}`, token)).status).toBe(200);
  });

  it('[TC-03-02] returns 401 without a token', async () => {
    const server = app.getHttpServer();

    expectError(
      await request(server).get('/api/sessions'),
      401,
      'UNAUTHORIZED',
    );
    expectError(
      await request(server).get(`/api/sessions/${randomUUID()}`),
      401,
      'UNAUTHORIZED',
    );
  });

  it('[TC-03-02] never returns the stored plan in the list', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'topic', '2026-01-01T10:00:00Z');

    const res = await get('/api/sessions', token);

    expect(JSON.stringify(res.body)).not.toMatch(/plan|questions/);
  });

  it('[TC-03-02] returns the utterances ordered by seq with text_verbatim as text', async () => {
    const { id, token } = await registerUser(app);
    const sessionId = await insertFinished(
      id,
      'ordered',
      '2026-01-01T10:00:00Z',
    );
    for (const [seq, role, text] of [
      [3, 'assistant', 'third'],
      [1, 'assistant', 'first'],
      [2, 'user', 'second'],
    ] as const) {
      await pool.query(
        `INSERT INTO utterances (session_id, seq, role, text_verbatim, text_clean, analysis_status)
         VALUES ($1, $2, $3, $4, 'cleaned', 'skipped')`,
        [sessionId, seq, role, text],
      );
    }

    const res = await get(`/api/sessions/${sessionId}`, token);
    const details = SessionDetailsSchema.parse(res.body);

    expect(details.id).toBe(sessionId);
    expect(details.utterances.map((u) => [u.seq, u.role, u.text])).toEqual([
      [1, 'assistant', 'first'],
      [2, 'user', 'second'],
      [3, 'assistant', 'third'],
    ]);
    expect(res.body).not.toHaveProperty('plan');
  });

  it('[TC-03-02] returns exactly the first question for a just started session', async () => {
    const { token } = await registerUser(app);
    await grantConsent(app, token);
    const startRes = await request(app.getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(PLAN);
    expect(startRes.status).toBe(201);
    const started = SessionDetailsSchema.parse(startRes.body);

    const res = await get(`/api/sessions/${started.id}`, token);

    expect(SessionDetailsSchema.parse(res.body)).toEqual(started);
    expect(started.utterances).toEqual([
      { id: expect.any(String), seq: 1, role: 'assistant', text: 'q1' },
    ]);
    expect(res.body).not.toHaveProperty('plan');
  });

  it('[TC-03-02] returns 404 SESSION_NOT_FOUND for the session of another user', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const sessionId = await insertFinished(
      owner.id,
      'private',
      '2026-01-01T10:00:00Z',
    );

    const res = await get(`/api/sessions/${sessionId}`, other.token);

    expectError(res, 404, 'SESSION_NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('private');
  });

  it('[TC-03-02] returns 404 SESSION_NOT_FOUND for an unknown uuid', async () => {
    const { token } = await registerUser(app);

    expectError(
      await get(`/api/sessions/${randomUUID()}`, token),
      404,
      'SESSION_NOT_FOUND',
    );
  });

  it('[TC-03-02] checks the id format first: a non-uuid id is 404, not 400', async () => {
    const { token } = await registerUser(app);

    expectError(
      await get('/api/sessions/not-a-uuid', token),
      404,
      'SESSION_NOT_FOUND',
    );
    expectError(
      await get('/api/sessions/123', token),
      404,
      'SESSION_NOT_FOUND',
    );
  });

  it('[TC-03-02] returns an empty list and 404 details for a token of a missing user', async () => {
    const token = await tokenOfMissingUser(app);

    expect(await list(token)).toEqual([]);
    expectError(
      await get(`/api/sessions/${randomUUID()}`, token),
      404,
      'SESSION_NOT_FOUND',
    );
  });

  it('[TC-03-02] returns an empty list and 404 details for a user deleted after login', async () => {
    const { id, token } = await registerUser(app);
    const sessionId = await insertFinished(id, 'gone', '2026-01-01T10:00:00Z');
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    expect(await list(token)).toEqual([]);
    expectError(
      await get(`/api/sessions/${sessionId}`, token),
      404,
      'SESSION_NOT_FOUND',
    );
  });
});
