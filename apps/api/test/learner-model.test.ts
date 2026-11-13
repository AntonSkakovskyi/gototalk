import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResponseSchema, LearnerModelSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

const PASSWORD = 'correct-horse-battery';
const MISSING_USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

type PatternSeed = readonly [
  category: string,
  frequency: number,
  lastSeenAt: string | null,
];
type WordSeed = readonly [state: string, total: number];

const PATTERNS: PatternSeed[] = [
  ['articles', 9, '2026-11-01 10:00:00+00'],
  ['verb_tense', 7, '2026-11-02 10:00:00+00'],
  ['prepositions', 5, '2026-11-03 10:00:00+00'],
  ['word_order', 5, '2026-11-10 10:00:00+00'],
  ['plural_countable', 5, null],
  ['collocation', 2, '2026-11-12 10:00:00+00'],
  ['conditionals', 0, '2026-11-13 10:00:00+00'],
];
const WORDS: WordSeed[] = [
  ['new', 3],
  ['passive', 2],
  ['active', 1],
];

describe('Learner model endpoint', () => {
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

  async function registerUser() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.com`, password: PASSWORD });
    const { accessToken, user } = AuthResponseSchema.parse(res.body);
    return { token: accessToken, id: user.id };
  }

  async function seedPatterns(userId: string, patterns: PatternSeed[]) {
    for (const [category, frequency, lastSeenAt] of patterns) {
      await pool.query(
        `INSERT INTO mistake_patterns (user_id, category, frequency, last_seen_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, category, frequency, lastSeenAt],
      );
    }
  }

  async function seedWords(userId: string, words: WordSeed[]) {
    for (const [state, total] of words) {
      for (let i = 0; i < total; i += 1) {
        await pool.query(
          `INSERT INTO words (user_id, lemma, state) VALUES ($1, $2, $3)`,
          [userId, `lemma-${randomUUID()}`, state],
        );
      }
    }
  }

  const getLearnerModel = (token: string) =>
    request(app.getHttpServer())
      .get('/api/profile/learner-model')
      .set('Authorization', `Bearer ${token}`);

  it('[TC-02-05] returns the top 5 patterns by frequency and the word counts per state', async () => {
    const user = await registerUser();
    const other = await registerUser();
    await seedPatterns(user.id, PATTERNS);
    await seedWords(user.id, WORDS);
    await seedPatterns(other.id, [['other', 50, '2026-11-13 11:00:00+00']]);
    await seedWords(other.id, [
      ['partial', 4],
      ['active', 6],
    ]);

    const res = await getLearnerModel(user.token);

    expect(res.status).toBe(200);
    const model = LearnerModelSchema.parse(res.body);
    expect(model.weakAreas).toHaveLength(5);
    expect(model.weakAreas.map((area) => area.category)).toEqual([
      'articles',
      'verb_tense',
      'word_order',
      'prepositions',
      'plural_countable',
    ]);
    expect(model.weakAreas.map((area) => area.frequency)).toEqual([
      9, 7, 5, 5, 5,
    ]);
    expect(model.vocabulary).toEqual({
      new: 3,
      partial: 0,
      passive: 2,
      active: 1,
    });
  });

  it('[TC-02-05] ties are broken by the latest last_seen_at, never-seen last, and dates are ISO strings', async () => {
    const user = await registerUser();
    await seedPatterns(user.id, PATTERNS);

    const model = LearnerModelSchema.parse(
      (await getLearnerModel(user.token)).body,
    );

    expect(model.weakAreas[2]).toEqual({
      category: 'word_order',
      frequency: 5,
      lastSeenAt: '2026-11-10T10:00:00.000Z',
    });
    expect(model.weakAreas[4]).toEqual({
      category: 'plural_countable',
      frequency: 5,
      lastSeenAt: null,
    });
  });

  it('[TC-02-05] patterns with frequency 0 are excluded', async () => {
    const user = await registerUser();
    await seedPatterns(user.id, [
      ['articles', 1, '2026-11-01 10:00:00+00'],
      ['conditionals', 0, '2026-11-13 10:00:00+00'],
    ]);

    const model = LearnerModelSchema.parse(
      (await getLearnerModel(user.token)).body,
    );

    expect(model.weakAreas.map((area) => area.category)).toEqual(['articles']);
  });

  it('[TC-02-05] a brand-new user gets no weak areas and zero counts', async () => {
    const { token } = await registerUser();

    const res = await getLearnerModel(token);

    expect(res.status).toBe(200);
    expect(LearnerModelSchema.parse(res.body)).toEqual({
      weakAreas: [],
      vocabulary: { new: 0, partial: 0, passive: 0, active: 0 },
    });
  });

  it('[TC-02-05] a user that no longer exists gets an empty model, not 401', async () => {
    const token = await app.get(JwtService).signAsync({ sub: MISSING_USER_ID });

    const res = await getLearnerModel(token);

    expect(res.status).toBe(200);
    expect(LearnerModelSchema.parse(res.body).weakAreas).toEqual([]);
  });

  it('[TC-02-05] the endpoint returns 401 without a token', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/profile/learner-model',
    );

    expect(res.status).toBe(401);
  });
});
