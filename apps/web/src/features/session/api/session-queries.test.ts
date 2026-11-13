import { ERROR_CODES } from '@gototalk/shared';
import {
  QueryClient,
  focusManager,
  onlineManager,
  useQuery,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { mockApi } from '@/shared/testing/mock-api';
import { createQueryWrapper } from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
  sessionListQueryOptions,
  sessionPlanQueryOptions,
} from './session-queries';

function fetchPlanWith(...responses: Response[]) {
  const queue = [...responses];
  const { requests } = mockApi({
    'POST /api/sessions/plan': () =>
      queue.shift() ?? errorResponse(500, 'RESPONSES_EXHAUSTED'),
  });
  const result = new QueryClient().query({
    ...sessionPlanQueryOptions({ previousTopics: [] }),
    retryDelay: 0,
  });
  return { requests, result };
}

describe('session queries', () => {
  it('[TC-03-03] keys are nested under the session root', () => {
    expect(sessionKeys.list()).toEqual(['session', 'list']);
    expect(sessionKeys.details('abc')).toEqual(['session', 'details', 'abc']);
  });

  it('[TC-03-03] plan keys differ per request', () => {
    const first = sessionKeys.plan({ previousTopics: [] });
    const second = sessionKeys.plan({ previousTopics: ['Travel'] });

    expect(first).not.toEqual(second);
    expect(first.slice(0, 2)).toEqual(['session', 'plan']);
  });

  it('[TC-03-03] a cached plan is served without a second POST', async () => {
    const { requests } = mockApi({
      'POST /api/sessions/plan': jsonResponse(testSessionPlan()),
    });
    const queryClient = new QueryClient();
    const options = sessionPlanQueryOptions({ previousTopics: [] });

    await queryClient.query(options);
    await queryClient.query(options);

    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] plan query does not retry a 4xx', async () => {
    const { requests, result } = fetchPlanWith(
      errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    );

    await expect(result).rejects.toMatchObject({ status: 403 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] plan query retries a server error once', async () => {
    const { requests, result } = fetchPlanWith(
      errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE),
      jsonResponse(testSessionPlan()),
    );

    await expect(result).resolves.toEqual(testSessionPlan());

    expect(requests).toHaveLength(2);
  });

  it('[TC-03-03] an observed plan is not refetched on focus or reconnect', async () => {
    const { requests } = mockApi({
      'POST /api/sessions/plan': jsonResponse(testSessionPlan()),
    });
    const { result } = renderHook(
      () => useQuery(sessionPlanQueryOptions({ previousTopics: [] })),
      { wrapper: createQueryWrapper(new QueryClient()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });

    expect(result.current.isFetching).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] list query does not retry a 4xx', async () => {
    const { requests } = mockApi({
      'GET /api/sessions': errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    });

    await expect(
      new QueryClient().query({ ...sessionListQueryOptions(), retryDelay: 0 }),
    ).rejects.toMatchObject({ status: 403 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] list query retries a server error once', async () => {
    const queue = [errorResponse(500, 'BOOM'), jsonResponse([])];
    const { requests } = mockApi({
      'GET /api/sessions': () =>
        queue.shift() ?? errorResponse(500, 'RESPONSES_EXHAUSTED'),
    });

    await expect(
      new QueryClient().query({ ...sessionListQueryOptions(), retryDelay: 0 }),
    ).resolves.toEqual([]);

    expect(requests).toHaveLength(2);
  });

  it('[TC-03-03] seeded details are served from the cache without a request', async () => {
    const details = testSessionDetails();
    const { requests } = mockApi({});
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionKeys.details(details.id), details);

    await expect(
      queryClient.query(sessionDetailsQueryOptions(details.id)),
    ).resolves.toEqual(details);

    expect(requests).toHaveLength(0);
  });

  it('[TC-03-03] details fetched on a direct visit are requested once', async () => {
    const details = testSessionDetails();
    const { requests } = mockApi({
      [`GET /api/sessions/${details.id}`]: jsonResponse(details),
    });

    await expect(
      new QueryClient().query(sessionDetailsQueryOptions(details.id)),
    ).resolves.toEqual(details);

    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] details query does not retry a missing session', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/abc': errorResponse(
        404,
        ERROR_CODES.SESSION_NOT_FOUND,
      ),
    });

    await expect(
      new QueryClient().query({
        ...sessionDetailsQueryOptions('abc'),
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(requests).toHaveLength(1);
  });
});
