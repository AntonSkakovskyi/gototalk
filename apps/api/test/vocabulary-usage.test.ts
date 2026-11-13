import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { AuthResponseSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DRIZZLE, PG_POOL } from '../src/core/db/db.tokens.js';
import type { Database } from '../src/core/db/db.tokens.js';
import { WordUsageService } from '../src/modules/vocabulary/word-usage.service.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PASSWORD = 'correct-horse-battery';

interface WordRow {
  lemma: string;
  state: string;
  times_used: number;
  last_used_at: Date | null;
}

describe('Word usage', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  let db: Database;
  let service: WordUsageService;

  beforeAll(async () => {
    app = await createTestApp();
    pool = app.get<pg.Pool>(PG_POOL);
    db = app.get<Database>(DRIZZLE);
    service = app.get(WordUsageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetUserData(pool);
  });

  async function registerUser(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.com`, password: PASSWORD });
    return AuthResponseSchema.parse(res.body).user.id;
  }

  async function seedWord(
    userId: string,
    lemma: string,
    state: string,
    timesUsed = 0,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO words (user_id, lemma, state, times_used) VALUES ($1, $2, $3, $4)`,
      [userId, lemma, state, timesUsed],
    );
  }

  async function readWords(userId: string): Promise<Map<string, WordRow>> {
    const { rows } = await pool.query<WordRow>(
      `SELECT lemma, state, times_used, last_used_at FROM words WHERE user_id = $1`,
      [userId],
    );
    return new Map(rows.map((row) => [row.lemma, row]));
  }

  function word(rows: Map<string, WordRow>, lemma: string): WordRow {
    const row = rows.get(lemma);
    if (!row) throw new Error(`Missing seeded word ${lemma}`);
    return row;
  }

  it('[TC-04-01] promotes passive and partial words, counts new ones, leaves active ones', async () => {
    const userId = await registerUser();
    const otherId = await registerUser();
    await seedWord(userId, 'deadline', 'passive', 2);
    await seedWord(userId, 'budget', 'partial', 0);
    await seedWord(userId, 'schedule', 'new', 1);
    await seedWord(userId, 'project', 'active', 5);
    await seedWord(userId, 'unrelated', 'passive', 3);
    await seedWord(otherId, 'deadline', 'passive', 2);

    const updated = await service.recordUsage(
      db,
      userId,
      'The deadline, budget, schedule and project are fine.',
    );

    expect(updated).toBe(3);
    const rows = await readWords(userId);
    expect(word(rows, 'deadline')).toMatchObject({
      state: 'active',
      times_used: 3,
    });
    expect(word(rows, 'deadline').last_used_at).toBeInstanceOf(Date);
    expect(word(rows, 'budget')).toMatchObject({
      state: 'active',
      times_used: 1,
    });
    expect(word(rows, 'schedule')).toMatchObject({
      state: 'new',
      times_used: 2,
    });
    expect(word(rows, 'schedule').last_used_at).toBeInstanceOf(Date);
    expect(word(rows, 'project')).toMatchObject({
      state: 'active',
      times_used: 5,
      last_used_at: null,
    });
    expect(word(rows, 'unrelated')).toMatchObject({
      state: 'passive',
      times_used: 3,
      last_used_at: null,
    });
    expect(word(await readWords(otherId), 'deadline')).toMatchObject({
      state: 'passive',
      times_used: 2,
      last_used_at: null,
    });
  });

  it('[TC-04-01] matches case-insensitively in both directions', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'passive');
    await seedWord(userId, 'Report', 'passive');

    const updated = await service.recordUsage(
      db,
      userId,
      'Meeting about the REPORT',
    );

    expect(updated).toBe(2);
    const rows = await readWords(userId);
    expect(word(rows, 'meeting').state).toBe('active');
    expect(word(rows, 'Report').state).toBe('active');
  });

  it('[TC-04-01] matches multi-word lemmas', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'be able to', 'passive');

    const updated = await service.recordUsage(
      db,
      userId,
      'I will be able to help.',
    );

    expect(updated).toBe(1);
    expect(word(await readWords(userId), 'be able to').state).toBe('active');
  });

  it('[TC-04-01] does not match inflected forms or substrings', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'passive');
    await seedWord(userId, 'team', 'passive');

    const updated = await service.recordUsage(
      db,
      userId,
      'Meetings with the steam',
    );

    expect(updated).toBe(0);
    const rows = await readWords(userId);
    expect(word(rows, 'meeting')).toMatchObject({
      state: 'passive',
      times_used: 0,
    });
    expect(word(rows, 'team')).toMatchObject({
      state: 'passive',
      times_used: 0,
    });
  });

  it('[TC-04-01] counts a word used several times in one utterance once', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'new');

    const updated = await service.recordUsage(
      db,
      userId,
      'meeting meeting Meeting',
    );

    expect(updated).toBe(1);
    expect(word(await readWords(userId), 'meeting').times_used).toBe(1);
  });

  it('[TC-04-01] returns 0 for text without words', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'passive');

    expect(await service.recordUsage(db, userId, '')).toBe(0);
    expect(word(await readWords(userId), 'meeting').state).toBe('passive');
  });

  it('[TC-04-01] persists nothing when the surrounding transaction rolls back', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'passive');

    await expect(
      db.transaction(async (tx) => {
        const updated = await service.recordUsage(tx, userId, 'a meeting');
        expect(updated).toBe(1);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(word(await readWords(userId), 'meeting')).toMatchObject({
      state: 'passive',
      times_used: 0,
      last_used_at: null,
    });
  });

  it('[TC-04-01] persists the update when the transaction commits', async () => {
    const userId = await registerUser();
    await seedWord(userId, 'meeting', 'passive');

    await db.transaction((tx) => service.recordUsage(tx, userId, 'a meeting'));

    expect(word(await readWords(userId), 'meeting')).toMatchObject({
      state: 'active',
      times_used: 1,
    });
  });
});
