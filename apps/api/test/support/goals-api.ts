import type { INestApplication } from '@nestjs/common';
import { ErrorResponseSchema, GoalSchema } from '@gototalk/shared';
import type { Goal, GoalStatus } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { expect } from 'vitest';
import { registerUser as registerApiUser } from './api-client.js';

export function goalAt(goals: Goal[], index: number): Goal {
  const goal = goals[index];
  if (!goal) throw new Error(`No goal at index ${index}`);
  return goal;
}

export function expectError(
  res: { status: number; body: unknown },
  status: number,
  code: string,
) {
  expect(res.status).toBe(status);
  expect(ErrorResponseSchema.parse(res.body).error.code).toBe(code);
}

export function createGoalsClient(
  getApp: () => INestApplication,
  getPool: () => pg.Pool,
) {
  const registerUser = () => registerApiUser(getApp());

  const listGoals = (token: string) =>
    request(getApp().getHttpServer())
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`);

  const createGoal = (token: string, body: object) =>
    request(getApp().getHttpServer())
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const patchGoal = (token: string, id: string, body: object) =>
    request(getApp().getHttpServer())
      .patch(`/api/goals/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const deleteGoal = (token: string, id: string) =>
    request(getApp().getHttpServer())
      .delete(`/api/goals/${id}`)
      .set('Authorization', `Bearer ${token}`);

  async function addGoal(token: string, title: string): Promise<Goal> {
    const res = await createGoal(token, { title });
    expect(res.status).toBe(201);
    return GoalSchema.parse(res.body);
  }

  async function addGoals(token: string, count: number): Promise<Goal[]> {
    const goals: Goal[] = [];
    for (let index = 1; index <= count; index += 1) {
      goals.push(await addGoal(token, `Goal ${index}`));
    }
    return goals;
  }

  async function countGoals(userId: string, status: GoalStatus) {
    const { rows } = await getPool().query<{ count: string }>(
      'SELECT count(*) FROM goals WHERE user_id = $1 AND status = $2',
      [userId, status],
    );
    return Number(rows[0]?.count);
  }

  return {
    registerUser,
    listGoals,
    createGoal,
    patchGoal,
    deleteGoal,
    addGoal,
    addGoals,
    countGoals,
  };
}
