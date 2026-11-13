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
  testSessionDetails,
} from '@/shared/testing/test-fixtures';
import { sessionKeys } from '@/features/session/api/session-queries';
import { useSessionDetails } from './use-session-details';

const DETAILS = testSessionDetails();

describe('useSessionDetails', () => {
  it('[TC-03-03] fetches the details on a direct visit', async () => {
    const { requests } = mockApi({
      [`GET /api/sessions/${DETAILS.id}`]: jsonResponse(DETAILS),
    });
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(() => useSessionDetails(DETAILS.id), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(DETAILS));
    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] serves freshly seeded details without a request', () => {
    const { requests } = mockApi({});
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sessionKeys.details(DETAILS.id), DETAILS);

    const { result } = renderHook(() => useSessionDetails(DETAILS.id), {
      wrapper: createQueryWrapper(queryClient),
    });

    expect(result.current.data).toEqual(DETAILS);
    expect(result.current.isFetching).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it('[TC-03-03] does not retry a missing session', async () => {
    const { requests } = mockApi({
      [`GET /api/sessions/${DETAILS.id}`]: errorResponse(
        404,
        ERROR_CODES.SESSION_NOT_FOUND,
      ),
    });
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(() => useSessionDetails(DETAILS.id), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toHaveLength(1);
  });
});
