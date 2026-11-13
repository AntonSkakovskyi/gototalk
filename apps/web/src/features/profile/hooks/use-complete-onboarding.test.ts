import { renderHook, waitFor } from '@testing-library/react';
import {
  CreateGoalRequestSchema,
  ERROR_CODES,
  type Goal,
} from '@gototalk/shared';
import { mockApi, type MockRequest } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import {
  TEST_PROFILE,
  errorResponse,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import { profileKeys } from '@/features/profile/api/profile-queries';
import { useCompleteOnboarding } from './use-complete-onboarding';

afterEach(() => {
  vi.unstubAllGlobals();
});

const INPUT = {
  level: TEST_PROFILE.level,
  scenes: TEST_PROFILE.scenes,
  goals: ['Speak fluently', 'Pass interviews'],
};

function setup() {
  const queryClient = createTestQueryClient();
  return { queryClient, wrapper: createQueryWrapper(queryClient) };
}

function calls(requests: MockRequest[]): string[] {
  return requests.map(({ method, path }) => `${method} ${path}`);
}

function titleOf(body: unknown): string {
  return CreateGoalRequestSchema.parse(body).title;
}

function postedBodies(requests: MockRequest[]): unknown[] {
  return requests
    .filter(({ method }) => method === 'POST')
    .map(({ body }) => body);
}

describe('useCompleteOnboarding', () => {
  it('[TC-02-02] lists goals, posts each missing goal, then puts the profile last', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(profileKeys.profile(), TEST_PROFILE);
    const { requests } = mockApi({
      'GET /api/goals': jsonResponse([]),
      'POST /api/goals': ({ body }) =>
        jsonResponse(
          testGoal({ id: crypto.randomUUID(), title: titleOf(body) }),
          201,
        ),
      'PUT /api/profile': jsonResponse(TEST_PROFILE),
    });
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls(requests)).toEqual([
      'GET /api/goals',
      'POST /api/goals',
      'POST /api/goals',
      'PUT /api/profile',
    ]);
    expect(postedBodies(requests)).toEqual([
      { title: 'Speak fluently' },
      { title: 'Pass interviews' },
    ]);
    expect(requests[3]?.body).toEqual({
      level: INPUT.level,
      scenes: INPUT.scenes,
    });
    expect(queryClient.getQueryData(profileKeys.profile())).toEqual(
      TEST_PROFILE,
    );
    expect(queryClient.getQueryState(profileKeys.goals())?.isInvalidated).toBe(
      true,
    );
  });

  it('[TC-02-02] does not post a title that matches an active goal ignoring case and spaces', async () => {
    const { wrapper } = setup();
    const { requests } = mockApi({
      'GET /api/goals': jsonResponse([testGoal()]),
      'POST /api/goals': jsonResponse(
        testGoal({ id: crypto.randomUUID() }),
        201,
      ),
      'PUT /api/profile': jsonResponse(TEST_PROFILE),
    });
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate({
      ...INPUT,
      goals: ['  SPEAK   fluently', ' speak fluently ', 'Pass interviews'],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postedBodies(requests)).toEqual([{ title: 'Pass interviews' }]);
  });

  it('[TC-02-02] posts a title that only matches a done goal', async () => {
    const { wrapper } = setup();
    const { requests } = mockApi({
      'GET /api/goals': jsonResponse([testGoal({ status: 'done' })]),
      'POST /api/goals': jsonResponse(
        testGoal({ id: crypto.randomUUID() }),
        201,
      ),
      'PUT /api/profile': jsonResponse(TEST_PROFILE),
    });
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate({ ...INPUT, goals: ['Speak fluently'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postedBodies(requests)).toEqual([{ title: 'Speak fluently' }]);
  });

  it('[TC-02-02] retrying after a failed profile save does not create duplicate goals', async () => {
    const { wrapper } = setup();
    const created: Goal[] = [];
    let profileAttempts = 0;
    const { requests } = mockApi({
      'GET /api/goals': () => jsonResponse(created),
      'POST /api/goals': ({ body }) => {
        const goal = testGoal({
          id: crypto.randomUUID(),
          title: titleOf(body),
        });
        created.push(goal);
        return jsonResponse(goal, 201);
      },
      'PUT /api/profile': () =>
        profileAttempts++ === 0
          ? errorResponse(500, 'UNKNOWN_ERROR')
          : jsonResponse(TEST_PROFILE),
    });
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isError).toBe(true));
    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(postedBodies(requests)).toHaveLength(2);
    expect(
      calls(requests).filter((c) => c === 'PUT /api/profile'),
    ).toHaveLength(2);
  });

  it('[TC-02-02] a 409 limit surfaces as ApiError and the profile is not saved', async () => {
    const { wrapper } = setup();
    const { requests } = mockApi({
      'GET /api/goals': jsonResponse([]),
      'POST /api/goals': errorResponse(409, ERROR_CODES.ACTIVE_GOALS_LIMIT),
      'PUT /api/profile': jsonResponse(TEST_PROFILE),
    });
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      status: 409,
      code: ERROR_CODES.ACTIVE_GOALS_LIMIT,
    });
    expect(calls(requests)).not.toContain('PUT /api/profile');
  });
});
