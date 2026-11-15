import type { INestApplication } from '@nestjs/common';
import { SessionPlanSchema, TOPIC_MAX } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { LANGUAGE_MODEL_PORT } from '../../../src/integrations/language-model/language-model.port.js';
import {
  expectError,
  grantConsent,
  putProfile,
  registerUser,
  tokenOfMissingUser,
} from '../../support/api-client.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

const SMALL_TALK_PROFILE = { level: 'B1', scenes: ['small_talk'] };

describe('POST /api/sessions/plan', () => {
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

  const plan = (token: string, body: object = {}) =>
    request(app.getHttpServer())
      .post('/api/sessions/plan')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  async function readyUser() {
    const user = await registerUser(app);
    await grantConsent(app, user.token);
    await putProfile(app, user.token, SMALL_TALK_PROFILE);
    return user;
  }

  async function countRows(table: 'sessions' | 'utterances'): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM ${table}`,
    );
    return Number(rows[0]?.count);
  }

  it('[TC-03-02] returns 403 CONSENT_REQUIRED before consent is given', async () => {
    const { token } = await registerUser(app);
    await putProfile(app, token, SMALL_TALK_PROFILE);

    expectError(await plan(token), 403, 'CONSENT_REQUIRED');
  });

  it('[TC-03-02] returns 401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sessions/plan')
      .send({});

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-03-02] returns 401 when the user no longer exists', async () => {
    const res = await plan(await tokenOfMissingUser(app));

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-03-01] returns 404 PROFILE_NOT_FOUND for a consented user without a profile', async () => {
    const { token } = await registerUser(app);
    await grantConsent(app, token);

    expectError(await plan(token), 404, 'PROFILE_NOT_FOUND');
  });

  it('[TC-03-01] proposes the first small_talk topic with five suggested questions', async () => {
    const { token } = await readyUser();

    const res = await plan(token);

    expect(res.status).toBe(200);
    const body = SessionPlanSchema.parse(res.body);
    expect(body.topic).toBe('Weekend plans');
    expect(body.topicSource).toBe('suggested');
    expect(body.questions).toHaveLength(5);
  });

  it.each([
    [['Weekend plans'], 'My hometown'],
    [['Weekend plans', 'My hometown'], 'Favourite food'],
    [['Weekend plans', 'My hometown', 'Favourite food'], 'A film I watched'],
  ])(
    '[TC-03-01] previousTopics %j gives the next topic %s',
    async (previousTopics, expected) => {
      const { token } = await readyUser();

      const res = await plan(token, { previousTopics });

      expect(res.status).toBe(200);
      expect(SessionPlanSchema.parse(res.body).topic).toBe(expected);
    },
  );

  it('[TC-03-01] returns 400 VALIDATION_ERROR for more than three previous topics', async () => {
    const { token } = await readyUser();

    const res = await plan(token, { previousTopics: ['a', 'b', 'c', 'd'] });

    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it.each([
    ['a blank customTopic', { customTopic: '   ' }],
    ['an over-long customTopic', { customTopic: 'x'.repeat(TOPIC_MAX + 1) }],
  ])('[TC-03-01] returns 400 VALIDATION_ERROR for %s', async (_name, body) => {
    const { token } = await readyUser();

    expectError(await plan(token, body), 400, 'VALIDATION_ERROR');
  });

  it('[TC-03-01] accepts a customTopic of the maximum length', async () => {
    const { token } = await readyUser();
    const customTopic = 'x'.repeat(TOPIC_MAX);

    const res = await plan(token, { customTopic });

    expect(res.status).toBe(200);
    expect(SessionPlanSchema.parse(res.body).topic).toBe(customTopic);
  });

  it('[TC-03-01] a custom topic is kept as entered (trimmed) with custom questions', async () => {
    const { token } = await readyUser();

    const res = await plan(token, {
      customTopic: '  Gardening  ',
      previousTopics: ['Weekend plans'],
    });

    expect(res.status).toBe(200);
    const body = SessionPlanSchema.parse(res.body);
    expect(body.topic).toBe('Gardening');
    expect(body.topicSource).toBe('custom');
    expect(body.questions[0]).toBe(
      'What is the first thing that comes to mind when you think about "Gardening"?',
    );
  });

  it('[TC-03-01] a weak verb_tense pattern replaces the first question', async () => {
    const { id, token } = await readyUser();
    await pool.query(
      "INSERT INTO mistake_patterns (user_id, category, frequency) VALUES ($1, 'verb_tense', 3)",
      [id],
    );

    const res = await plan(token);

    expect(res.status).toBe(200);
    expect(SessionPlanSchema.parse(res.body).questions[0]).toBe(
      'Tell me what you did yesterday at work.',
    );
  });

  it('[TC-03-01] active goals are accepted and do not change the Fake plan', async () => {
    const { token } = await readyUser();
    const before = SessionPlanSchema.parse((await plan(token)).body);
    for (const title of [
      'Pass the interview',
      'Speak faster',
      'Fewer pauses',
    ]) {
      const created = await request(app.getHttpServer())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title });
      expect(created.status).toBe(201);
    }

    const res = await plan(token);

    expect(res.status).toBe(200);
    expect(SessionPlanSchema.parse(res.body)).toEqual(before);
  });

  it('[TC-03-01] planning stores no sessions or utterances', async () => {
    const { token } = await readyUser();

    await plan(token);
    await plan(token, { customTopic: 'Gardening' });

    expect(await countRows('sessions')).toBe(0);
    expect(await countRows('utterances')).toBe(0);
  });
});

describe('POST /api/sessions/plan with an invalid model response', () => {
  const planSession = vi
    .fn()
    .mockResolvedValue({ garbage: 'SECRET-VALUE-xyz' });
  let app: INestApplication;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await createTestApp({
      providers: [{ token: LANGUAGE_MODEL_PORT, useValue: { planSession } }],
    });
    pool = app.get<pg.Pool>(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    planSession.mockClear();
    await resetUserData(pool);
  });

  it('[TC-03-01] returns 502 LANGUAGE_MODEL_INVALID_RESPONSE after one retry with a generic message', async () => {
    const { token } = await registerUser(app);
    await grantConsent(app, token);
    await putProfile(app, token, SMALL_TALK_PROFILE);

    const res = await request(app.getHttpServer())
      .post('/api/sessions/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expectError(res, 502, 'LANGUAGE_MODEL_INVALID_RESPONSE');
    expect(res.body.error.message).toBe('Bad Gateway');
    expect(JSON.stringify(res.body)).not.toContain('SECRET-VALUE-xyz');
    expect(planSession).toHaveBeenCalledTimes(2);
  });
});
