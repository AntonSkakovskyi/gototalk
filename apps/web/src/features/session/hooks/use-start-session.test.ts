import { ERROR_CODES } from '@gototalk/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { mockApi } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSession,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import { sessionKeys } from '@/features/session/api/session-queries';
import { useStartSession } from './use-start-session';

const REQUEST = { ...testSessionPlan(), feedbackMode: 'immediate' as const };

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.list(), [testSession()]);
  return { queryClient, wrapper: createQueryWrapper(queryClient) };
}

describe('useStartSession', () => {
  it('[TC-03-03] seeds the details cache and invalidates the list', async () => {
    const { queryClient, wrapper } = setup();
    const details = testSessionDetails();
    const { requests } = mockApi({
      'POST /api/sessions': jsonResponse(details, 201),
    });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]?.body).toEqual(REQUEST);
    expect(queryClient.getQueryData(sessionKeys.details(details.id))).toEqual(
      details,
    );
    expect(queryClient.getQueryState(sessionKeys.list())?.isInvalidated).toBe(
      true,
    );
  });

  it('[TC-03-03] the seeded details are readable without a refetch', async () => {
    const { queryClient, wrapper } = setup();
    const details = testSessionDetails();
    const { requests } = mockApi({
      'POST /api/sessions': jsonResponse(details, 201),
    });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(sessionKeys.details(details.id))).toEqual(
      details,
    );
    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] a failed start surfaces the error and still invalidates the list', async () => {
    const { queryClient, wrapper } = setup();
    mockApi({
      'POST /api/sessions': errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      status: 403,
      code: ERROR_CODES.CONSENT_REQUIRED,
    });
    expect(queryClient.getQueryState(sessionKeys.list())?.isInvalidated).toBe(
      true,
    );
  });
});
