import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoalListSchema, GoalSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import { GoalsService } from '../../../src/modules/profile/goals.service.js';
import {
  createGoalsClient,
  expectError,
  goalAt,
} from '../../support/goals-api.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

const MISSING_USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

describe('Goals endpoints', () => {
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

  const {
    registerUser,
    listGoals,
    createGoal,
    patchGoal,
    deleteGoal,
    addGoal,
    addGoals,
    countGoals,
  } = createGoalsClient(
    () => app,
    () => pool,
  );

  const tokenOfMissingUser = () =>
    app.get(JwtService).signAsync({ sub: MISSING_USER_ID });

  it('[TC-02-02] a new user has no goals', async () => {
    const { token } = await registerUser();

    const res = await listGoals(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('[TC-02-02] POST creates an active goal and GET lists it', async () => {
    const { token } = await registerUser();

    const created = await createGoal(token, { title: '  Speak at meetings  ' });

    expect(created.status).toBe(201);
    const goal = GoalSchema.parse(created.body);
    expect(goal).toMatchObject({
      title: 'Speak at meetings',
      status: 'active',
    });

    const list = await listGoals(token);
    expect(list.status).toBe(200);
    expect(GoalListSchema.parse(list.body)).toEqual([goal]);
  });

  it('[TC-02-02] GET lists goals ordered by creation time', async () => {
    const { id, token } = await registerUser();
    const goals = await addGoals(token, 3);
    await pool.query(
      `UPDATE goals SET created_at = '2020-01-01 00:00:00+00' WHERE id = $1`,
      [goalAt(goals, 2).id],
    );

    const list = GoalListSchema.parse((await listGoals(token)).body);

    expect(list.map((goal) => goal.title)).toEqual([
      'Goal 3',
      'Goal 1',
      'Goal 2',
    ]);
    expect(list).toHaveLength(await countGoals(id, 'active'));
  });

  it('[TC-02-02] PATCH changes the title and the status', async () => {
    const { token } = await registerUser();
    const goal = await addGoal(token, 'Old title');

    const renamed = await patchGoal(token, goal.id, { title: ' New title ' });
    const done = await patchGoal(token, goal.id, { status: 'done' });

    expect(renamed.status).toBe(200);
    expect(GoalSchema.parse(renamed.body)).toEqual({
      ...goal,
      title: 'New title',
    });
    expect(done.status).toBe(200);
    expect(GoalSchema.parse(done.body)).toEqual({
      ...goal,
      title: 'New title',
      status: 'done',
    });
    expect(GoalListSchema.parse((await listGoals(token)).body)).toEqual([
      GoalSchema.parse(done.body),
    ]);
  });

  it('[TC-02-02] DELETE removes the goal with 204', async () => {
    const { token } = await registerUser();
    const goal = await addGoal(token, 'Temporary');

    const res = await deleteGoal(token, goal.id);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect((await listGoals(token)).body).toEqual([]);
    expectError(await deleteGoal(token, goal.id), 404, 'GOAL_NOT_FOUND');
  });

  it('[TC-02-02] user B never sees the goals of user A', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await addGoals(a.token, 2);
    await addGoal(b.token, 'Mine');

    const list = GoalListSchema.parse((await listGoals(b.token)).body);

    expect(list.map((goal) => goal.title)).toEqual(['Mine']);
  });

  it('[TC-02-02] user B gets the same 404 for a goal of user A as for a random id', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const goal = goalAt(await addGoals(a.token, 1), 0);
    const foreignId = goal.id;

    const foreignPatch = await patchGoal(b.token, foreignId, { title: 'Hack' });
    const randomPatch = await patchGoal(b.token, randomUUID(), {
      title: 'Hack',
    });
    const foreignDelete = await deleteGoal(b.token, foreignId);
    const randomDelete = await deleteGoal(b.token, randomUUID());

    expectError(foreignPatch, 404, 'GOAL_NOT_FOUND');
    expect(foreignPatch.body).toEqual(randomPatch.body);
    expectError(foreignDelete, 404, 'GOAL_NOT_FOUND');
    expect(foreignDelete.body).toEqual(randomDelete.body);
    expect(GoalListSchema.parse((await listGoals(a.token)).body)).toEqual([
      goal,
    ]);
  });

  it('[TC-02-02] an id that is not a uuid gives 404 GOAL_NOT_FOUND', async () => {
    const { token } = await registerUser();

    expectError(
      await patchGoal(token, 'not-a-uuid', { title: 'x' }),
      404,
      'GOAL_NOT_FOUND',
    );
    expectError(await deleteGoal(token, 'not-a-uuid'), 404, 'GOAL_NOT_FOUND');
  });

  it('[TC-02-02] POST and PATCH return 401 when the user no longer exists', async () => {
    const token = await tokenOfMissingUser();

    expectError(
      await createGoal(token, { title: 'Goal' }),
      401,
      'UNAUTHORIZED',
    );
    expectError(
      await patchGoal(token, randomUUID(), { title: 'Goal' }),
      401,
      'UNAUTHORIZED',
    );
  });

  it('[TC-02-02] GET returns an empty list and DELETE 404 when the user no longer exists', async () => {
    const token = await tokenOfMissingUser();

    const list = await listGoals(token);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
    expectError(await deleteGoal(token, randomUUID()), 404, 'GOAL_NOT_FOUND');
  });

  it('[TC-02-02] goal routes return 401 without a token', async () => {
    const server = request(app.getHttpServer());
    const id = randomUUID();

    const responses = await Promise.all([
      server.get('/api/goals'),
      server.post('/api/goals').send({ title: 'Goal' }),
      server.patch(`/api/goals/${id}`).send({ title: 'Goal' }),
      server.delete(`/api/goals/${id}`),
    ]);

    expect(responses.map((res) => res.status)).toEqual([401, 401, 401, 401]);
  });

  it.each([
    ['a missing title', {}],
    ['an empty title', { title: '   ' }],
    ['a title over 200 characters', { title: 'x'.repeat(201) }],
    ['a non-string title', { title: 5 }],
  ])(
    '[TC-02-02] POST /api/goals with %s returns 400 VALIDATION_ERROR',
    async (_name, body) => {
      const { token } = await registerUser();

      expectError(await createGoal(token, body), 400, 'VALIDATION_ERROR');
      expect((await listGoals(token)).body).toEqual([]);
    },
  );

  it.each([
    ['an empty body', {}],
    ['an unknown status', { status: 'archived' }],
    ['an empty title', { title: '' }],
  ])(
    '[TC-02-02] PATCH /api/goals/:id with %s returns 400 VALIDATION_ERROR',
    async (_name, body) => {
      const { token } = await registerUser();
      const goal = await addGoal(token, 'Goal');

      expectError(
        await patchGoal(token, goal.id, body),
        400,
        'VALIDATION_ERROR',
      );
    },
  );

  it('[TC-03-01] listActive returns only active goals in creation order', async () => {
    const { token, id } = await registerUser();
    const goals = await addGoals(token, 3);
    await patchGoal(token, goalAt(goals, 1).id, { status: 'done' });

    const active = await app.get(GoalsService).listActive(id);

    expect(active.map((goal) => goal.id)).toEqual([
      goalAt(goals, 0).id,
      goalAt(goals, 2).id,
    ]);
    expect(active.every((goal) => goal.status === 'active')).toBe(true);
    expect(GoalListSchema.parse(active)).toEqual(active);
  });

  it('[TC-03-01] listActive excludes goals of other users', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await addGoal(owner.token, 'Mine');
    const theirs = await addGoal(other.token, 'Theirs');

    const active = await app.get(GoalsService).listActive(other.id);

    expect(active.map((goal) => goal.id)).toEqual([theirs.id]);
  });

  it('[TC-03-01] listActive is empty for a user without goals and for an unknown user', async () => {
    const { id } = await registerUser();
    const service = app.get(GoalsService);

    expect(await service.listActive(id)).toEqual([]);
    expect(await service.listActive(MISSING_USER_ID)).toEqual([]);
  });
});
