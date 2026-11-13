import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ERROR_CODES } from '@gototalk/shared';
import { mockApi } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import {
  TEST_PROFILE,
  emptyResponse,
  errorResponse,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import { profileKeys } from '@/features/profile/api/profile-queries';
import {
  useCreateGoal,
  useDeleteGoal,
  useUpdateGoal,
} from './use-goal-mutations';

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(profileKeys.goals(), [testGoal()]);
  queryClient.setQueryData(profileKeys.profile(), TEST_PROFILE);
  return { queryClient, wrapper: createQueryWrapper(queryClient) };
}

function isInvalidated(queryClient: QueryClient, key: readonly string[]) {
  return queryClient.getQueryState(key)?.isInvalidated;
}

describe('goal mutations', () => {
  it('[TC-02-02] createGoal posts the title and invalidates goals only', async () => {
    const { queryClient, wrapper } = setup();
    const created = testGoal({
      id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0002',
      title: 'Pass interviews',
    });
    const { requests } = mockApi({
      'POST /api/goals': jsonResponse(created, 201),
    });
    const { result } = renderHook(() => useCreateGoal(), { wrapper });

    result.current.mutate({ title: 'Pass interviews' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]?.body).toEqual({ title: 'Pass interviews' });
    expect(isInvalidated(queryClient, profileKeys.goals())).toBe(true);
    expect(isInvalidated(queryClient, profileKeys.profile())).toBe(false);
  });

  it('[TC-02-02] updateGoal patches the goal and invalidates goals', async () => {
    const { queryClient, wrapper } = setup();
    const done = testGoal({ status: 'done' });
    const { requests } = mockApi({
      [`PATCH /api/goals/${done.id}`]: jsonResponse(done),
    });
    const { result } = renderHook(() => useUpdateGoal(), { wrapper });

    result.current.mutate({ id: done.id, request: { status: 'done' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isInvalidated(queryClient, profileKeys.goals())).toBe(true);
    expect(requests[0]?.body).toEqual({ status: 'done' });
  });

  it('[TC-02-02] deleteGoal deletes the goal and invalidates goals', async () => {
    const { queryClient, wrapper } = setup();
    const { requests } = mockApi({
      'DELETE /api/goals/goal-1': emptyResponse(),
    });
    const { result } = renderHook(() => useDeleteGoal(), { wrapper });

    result.current.mutate('goal-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]?.method).toBe('DELETE');
    expect(isInvalidated(queryClient, profileKeys.goals())).toBe(true);
  });

  it('[TC-02-02] a 409 limit error surfaces as ApiError and goals are invalidated', async () => {
    const { queryClient, wrapper } = setup();
    mockApi({
      'POST /api/goals': errorResponse(409, ERROR_CODES.ACTIVE_GOALS_LIMIT),
    });
    const { result } = renderHook(() => useCreateGoal(), { wrapper });

    result.current.mutate({ title: 'Fourth' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      status: 409,
      code: ERROR_CODES.ACTIVE_GOALS_LIMIT,
    });
    expect(isInvalidated(queryClient, profileKeys.goals())).toBe(true);
  });
});
