import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  SessionPageSchema,
} from '@gototalk/shared';
import type { SessionPage } from '@gototalk/shared';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeCursor } from '../../../src/common/pagination/keyset-cursor.js';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  expectError,
  registerUser,
  tokenOfMissingUser,
} from '../../support/api-client.js';
import { insertFinished as insertFinishedSession } from '../../support/session-fixtures.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('GET /api/sessions/history', () => {
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

  const insertFinished = (userId: string, topic: string, startedAt: string) =>
    insertFinishedSession(pool, userId, topic, startedAt);

  async function insertActive(userId: string, topic: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO sessions (user_id, topic, status, plan)
       VALUES ($1, $2, 'active', $3) RETURNING id`,
      [userId, topic, JSON.stringify({ questions: ['q'] })],
    );
    const row = rows[0];
    if (!row) throw new Error('Session insert returned no row');
    return row.id;
  }

  const getHistory = (token: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/sessions/history${query}`)
      .set('Authorization', `Bearer ${token}`);

  async function page(token: string, query = ''): Promise<SessionPage> {
    const res = await getHistory(token, query);
    expect(res.status).toBe(200);
    return SessionPageSchema.parse(res.body);
  }

  async function collectAll(token: string, limit: number) {
    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const cursorQuery: string =
        cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
      const current: SessionPage = await page(
        token,
        `?limit=${limit}${cursorQuery}`,
      );
      ids.push(...current.items.map((item) => item.id));
      cursor = current.nextCursor;
      pages += 1;
      expect(pages).toBeLessThan(50);
    } while (cursor !== null);
    return { ids, pages };
  }

  it('[TC-05-03] lists the sessions newest first', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'a', '2026-01-01T10:00:00Z');
    await insertFinished(id, 'c', '2026-03-01T10:00:00Z');
    await insertFinished(id, 'b', '2026-02-01T10:00:00Z');

    const result = await page(token);

    expect(result.items.map((session) => session.topic)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('[TC-05-03] pages of two cover five sessions without gaps or duplicates', async () => {
    const { id, token } = await registerUser(app);
    const expected: string[] = [];
    for (let day = 1; day <= 5; day += 1) {
      const sessionId = await insertFinished(
        id,
        `day ${day}`,
        `2026-01-0${day}T10:00:00Z`,
      );
      expected.unshift(sessionId);
    }

    const first = await page(token, '?limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const { ids, pages } = await collectAll(token, 2);
    expect(ids).toEqual(expected);
    expect(pages).toBe(3);
  });

  it('[TC-05-03] returns a null cursor on an exactly full last page', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'a', '2026-01-01T10:00:00Z');
    await insertFinished(id, 'b', '2026-01-02T10:00:00Z');

    const result = await page(token, '?limit=2');

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('[TC-05-03] paginates sessions with an identical started_at by id', async () => {
    const { id, token } = await registerUser(app);
    const sameTime: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      sameTime.push(
        await insertFinished(id, `same ${index}`, '2026-01-01T10:00:00Z'),
      );
    }

    const { ids } = await collectAll(token, 2);

    expect(ids).toEqual([...sameTime].sort().reverse());
  });

  it('[TC-05-03] neither skips nor duplicates sessions that differ only in microseconds', async () => {
    const { id, token } = await registerUser(app);
    const newest = await insertFinished(
      id,
      'us 789',
      '2026-01-01 10:00:00.123789+00',
    );
    const middle = await insertFinished(
      id,
      'us 456',
      '2026-01-01 10:00:00.123456+00',
    );
    const oldest = await insertFinished(
      id,
      'us 000',
      '2026-01-01 10:00:00.123000+00',
    );

    const { ids, pages } = await collectAll(token, 1);

    expect(ids).toEqual([newest, middle, oldest]);
    expect(pages).toBe(3);
  });

  it('[TC-05-03] applies the default page size', async () => {
    const { id, token } = await registerUser(app);
    const total = PAGE_SIZE_DEFAULT + 1;
    for (let index = 0; index < total; index += 1) {
      const minute = String(index).padStart(2, '0');
      await insertFinished(id, `n ${index}`, `2026-01-01T10:${minute}:00Z`);
    }

    const result = await page(token);

    expect(result.items).toHaveLength(PAGE_SIZE_DEFAULT);
    expect(result.nextCursor).not.toBeNull();
  });

  it('[TC-05-03] accepts the maximum limit and rejects values outside 1..max', async () => {
    const { token } = await registerUser(app);

    expect((await getHistory(token, `?limit=${PAGE_SIZE_MAX}`)).status).toBe(
      200,
    );
    for (const limit of [PAGE_SIZE_MAX + 1, 0, -1, 'abc', '1.5', '']) {
      expectError(
        await getHistory(token, `?limit=${limit}`),
        400,
        'VALIDATION_ERROR',
      );
    }
  });

  it('[TC-05-03] answers a tampered or garbage cursor with 400 VALIDATION_ERROR', async () => {
    const { token } = await registerUser(app);
    const id = randomUUID();
    const cursors = [
      'garbage',
      '%25%25%25',
      encodeCursor({ t: 'yesterday', id }),
      encodeCursor({ t: '2026-02-31 10:00:00+00', id }),
      encodeCursor({ t: '2026-01-01 10:00:00+00', id: 'not-a-uuid' }),
      'x'.repeat(201),
    ];

    for (const cursor of cursors) {
      expectError(
        await getHistory(token, `?cursor=${cursor}`),
        400,
        'VALIDATION_ERROR',
      );
    }
    expectError(await getHistory(token, '?cursor='), 400, 'VALIDATION_ERROR');
  });

  it('[TC-05-03] never returns the sessions of another user', async () => {
    const mine = await registerUser(app);
    const other = await registerUser(app);
    await insertFinished(mine.id, 'mine', '2026-01-01T10:00:00Z');
    await insertFinished(other.id, 'theirs', '2026-02-01T10:00:00Z');

    const result = await page(mine.token);

    expect(result.items.map((session) => session.topic)).toEqual(['mine']);
  });

  it('[TC-05-03] ignores the sessions of another user when a foreign cursor is used', async () => {
    const mine = await registerUser(app);
    const other = await registerUser(app);
    await insertFinished(mine.id, 'mine 1', '2026-01-01T10:00:00Z');
    await insertFinished(mine.id, 'mine 2', '2026-01-02T10:00:00Z');
    await insertFinished(other.id, 'theirs 1', '2026-01-03T10:00:00Z');
    await insertFinished(other.id, 'theirs 2', '2026-01-04T10:00:00Z');
    const foreign = await page(other.token, '?limit=1');

    const result = await page(
      mine.token,
      `?cursor=${encodeURIComponent(foreign.nextCursor ?? '')}`,
    );

    expect(result.items.map((session) => session.topic)).toEqual([
      'mine 2',
      'mine 1',
    ]);
  });

  it('[TC-05-03] returns an empty page for a deleted user with a valid token', async () => {
    const token = await tokenOfMissingUser(app);

    expect(await page(token)).toEqual({ items: [], nextCursor: null });
  });

  it('[TC-05-03] returns an empty page for a user without sessions', async () => {
    const { token } = await registerUser(app);

    expect(await page(token)).toEqual({ items: [], nextCursor: null });
  });

  it('[TC-05-03] includes active and finished sessions', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'done', '2026-01-01T10:00:00Z');
    const activeId = await insertActive(id, 'running');

    const result = await page(token);

    expect(result.items.map((session) => session.status)).toEqual([
      'active',
      'finished',
    ]);
    expect(result.items[0]?.id).toBe(activeId);
    expect(result.items[0]?.endedAt).toBeNull();
  });

  it('[TC-05-03] is not shadowed by GET /api/sessions/:id and leaves GET /api/sessions unchanged', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'only', '2026-01-01T10:00:00Z');

    const history = await getHistory(token);
    const list = await request(app.getHttpServer())
      .get('/api/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(history.body).toHaveProperty('items');
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body).toHaveLength(1);
  });

  it('[TC-05-03] never returns the stored plan', async () => {
    const { id, token } = await registerUser(app);
    await insertFinished(id, 'topic', '2026-01-01T10:00:00Z');

    const res = await getHistory(token);

    expect(res.body.items[0]).not.toHaveProperty('plan');
  });

  it('[TC-05-03] returns 401 without a token', async () => {
    expectError(
      await request(app.getHttpServer()).get('/api/sessions/history'),
      401,
      'UNAUTHORIZED',
    );
  });
});
