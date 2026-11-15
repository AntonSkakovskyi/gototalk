import type { INestApplication } from '@nestjs/common';
import {
  ErrorResponseSchema,
  GoalSchema,
  MAX_ACTIVE_GOALS,
} from '@gototalk/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../../../src/core/db/db.tokens.js';
import {
  createGoalsClient,
  expectError,
  goalAt,
} from '../../support/goals-api.js';
import { createTestApp } from '../../support/test-app.js';
import { resetUserData } from '../../support/test-db.js';

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

  it('[TC-02-02] the 4th active goal gives 409 ACTIVE_GOALS_LIMIT', async () => {
    const { id, token } = await registerUser();
    await addGoals(token, MAX_ACTIVE_GOALS);

    const res = await createGoal(token, { title: 'One too many' });

    expectError(res, 409, 'ACTIVE_GOALS_LIMIT');
    expect(ErrorResponseSchema.parse(res.body).error.message).toBe(
      'You can have at most 3 active goals',
    );
    expect(await countGoals(id, 'active')).toBe(MAX_ACTIVE_GOALS);
  });

  it('[TC-02-02] reactivating a done goal at the limit gives 409 until a slot is freed', async () => {
    const { token } = await registerUser();
    const goals = await addGoals(token, MAX_ACTIVE_GOALS);
    const first = goalAt(goals, 0);
    const second = goalAt(goals, 1);
    await patchGoal(token, first.id, { status: 'done' });
    await addGoal(token, 'Replacement');

    expectError(
      await patchGoal(token, first.id, { status: 'active' }),
      409,
      'ACTIVE_GOALS_LIMIT',
    );

    await deleteGoal(token, second.id);
    const reactivated = await patchGoal(token, first.id, {
      status: 'active',
    });
    expect(reactivated.status).toBe(200);
    expect(GoalSchema.parse(reactivated.body).status).toBe('active');
  });

  it('[TC-02-02] marking a goal done frees a slot for a new one', async () => {
    const { id, token } = await registerUser();
    const first = goalAt(await addGoals(token, MAX_ACTIVE_GOALS), 0);
    await patchGoal(token, first.id, { status: 'done' });

    const res = await createGoal(token, { title: 'Fresh goal' });

    expect(res.status).toBe(201);
    expect(await countGoals(id, 'active')).toBe(MAX_ACTIVE_GOALS);
    expect(await countGoals(id, 'done')).toBe(1);
  });

  it('[TC-02-02] an active goal can be renamed or re-saved as active with 3 active', async () => {
    const { token } = await registerUser();
    const first = goalAt(await addGoals(token, MAX_ACTIVE_GOALS), 0);

    const renamed = await patchGoal(token, first.id, {
      title: 'Renamed',
      status: 'active',
    });

    expect(renamed.status).toBe(200);
    expect(GoalSchema.parse(renamed.body).title).toBe('Renamed');
  });

  it('[TC-02-02] parallel POSTs cannot exceed the limit', async () => {
    const { id, token } = await registerUser();
    await addGoals(token, MAX_ACTIVE_GOALS - 1);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        createGoal(token, { title: `Parallel ${index}` }),
      ),
    );

    const statuses = results.map((res) => res.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await countGoals(id, 'active')).toBe(MAX_ACTIVE_GOALS);
  });

  it('[TC-02-02] parallel reactivations of done goals cannot exceed the limit', async () => {
    const { id, token } = await registerUser();
    const goals = await addGoals(token, MAX_ACTIVE_GOALS);
    const first = goalAt(goals, 0);
    const second = goalAt(goals, 1);
    await patchGoal(token, first.id, { status: 'done' });
    await patchGoal(token, second.id, { status: 'done' });
    await addGoal(token, 'Replacement');
    expect(await countGoals(id, 'active')).toBe(MAX_ACTIVE_GOALS - 1);

    const results = await Promise.all([
      patchGoal(token, first.id, { status: 'active' }),
      patchGoal(token, second.id, { status: 'active' }),
    ]);

    const statuses = results.map((res) => res.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(await countGoals(id, 'active')).toBe(MAX_ACTIVE_GOALS);
  });
});
