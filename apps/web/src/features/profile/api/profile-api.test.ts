import { ERROR_CODES } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_LEARNER_MODEL,
  TEST_PROFILE,
  emptyResponse,
  errorResponse,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import {
  createGoal,
  deleteGoal,
  getLearnerModel,
  getProfile,
  listGoals,
  updateGoal,
  updateProfile,
} from './profile-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profile api', () => {
  it('[TC-02-02] getProfile returns the parsed profile', async () => {
    mockApi({ 'GET /api/profile': jsonResponse(TEST_PROFILE) });

    await expect(getProfile()).resolves.toEqual(TEST_PROFILE);
  });

  it('[TC-02-02] getProfile surfaces PROFILE_NOT_FOUND', async () => {
    mockApi({
      'GET /api/profile': errorResponse(404, ERROR_CODES.PROFILE_NOT_FOUND),
    });

    await expect(getProfile()).rejects.toMatchObject({
      status: 404,
      code: ERROR_CODES.PROFILE_NOT_FOUND,
    });
  });

  it('[TC-02-02] getProfile rejects a response that breaks the contract', async () => {
    mockApi({ 'GET /api/profile': jsonResponse({ level: 'Z9' }) });

    await expect(getProfile()).rejects.toThrow();
  });

  it('[TC-02-02] updateProfile puts the request body', async () => {
    const { requests } = mockApi({
      'PUT /api/profile': jsonResponse(TEST_PROFILE),
    });
    const request = { level: TEST_PROFILE.level, scenes: TEST_PROFILE.scenes };

    await expect(updateProfile(request)).resolves.toEqual(TEST_PROFILE);

    expect(requests[0]?.body).toEqual(request);
  });

  it('[TC-02-02] listGoals returns the parsed goals', async () => {
    const goals = [testGoal(), testGoal({ status: 'done' })];
    mockApi({ 'GET /api/goals': jsonResponse(goals) });

    await expect(listGoals()).resolves.toEqual(goals);
  });

  it('[TC-02-02] createGoal posts the title and returns the goal', async () => {
    const goal = testGoal();
    const { requests } = mockApi({
      'POST /api/goals': jsonResponse(goal, 201),
    });

    await expect(createGoal({ title: goal.title })).resolves.toEqual(goal);

    expect(requests[0]?.body).toEqual({ title: goal.title });
  });

  it('[TC-02-02] createGoal surfaces ACTIVE_GOALS_LIMIT', async () => {
    mockApi({
      'POST /api/goals': errorResponse(409, ERROR_CODES.ACTIVE_GOALS_LIMIT),
    });

    await expect(createGoal({ title: 'Fourth' })).rejects.toMatchObject({
      status: 409,
      code: ERROR_CODES.ACTIVE_GOALS_LIMIT,
    });
  });

  it('[TC-02-02] updateGoal patches the goal by id', async () => {
    const goal = testGoal({ status: 'done' });
    const { requests } = mockApi({
      [`PATCH /api/goals/${goal.id}`]: jsonResponse(goal),
    });

    await expect(updateGoal(goal.id, { status: 'done' })).resolves.toEqual(
      goal,
    );

    expect(requests[0]?.body).toEqual({ status: 'done' });
  });

  it('[TC-02-02] deleteGoal sends DELETE and resolves without a body', async () => {
    const { requests } = mockApi({
      'DELETE /api/goals/goal-1': emptyResponse(),
    });

    await expect(deleteGoal('goal-1')).resolves.toBeUndefined();

    expect(requests).toHaveLength(1);
  });

  it('[TC-02-02] deleteGoal surfaces GOAL_NOT_FOUND', async () => {
    mockApi({
      'DELETE /api/goals/goal-1': errorResponse(
        404,
        ERROR_CODES.GOAL_NOT_FOUND,
      ),
    });

    await expect(deleteGoal('goal-1')).rejects.toMatchObject({
      status: 404,
      code: ERROR_CODES.GOAL_NOT_FOUND,
    });
  });

  it('[TC-02-05] getLearnerModel returns the parsed model', async () => {
    mockApi({
      'GET /api/profile/learner-model': jsonResponse(TEST_LEARNER_MODEL),
    });

    await expect(getLearnerModel()).resolves.toEqual(TEST_LEARNER_MODEL);
  });
});
