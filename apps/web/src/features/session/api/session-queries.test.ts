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
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import {
  testSession,
  testSessionPlan,
} from '@/shared/testing/fixtures/session';
import { sessionKeys } from '@/shared/api/session-details';
import {
  sessionHistoryQueryOptions,
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

  it('[TC-05-03] history query uses the shared key and the first page has no cursor', async () => {
    const page = { items: [testSession()], nextCursor: null };
    const { requests } = mockApi({
      'GET /api/sessions/history': jsonResponse(page),
    });
    const queryClient = new QueryClient();
    const options = sessionHistoryQueryOptions();

    const data = await queryClient.fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(sessionKeys.history());
    expect(data.pages).toEqual([page]);
    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] history query pages by the previous nextCursor and stops on null', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/history': jsonResponse({
        items: [],
        nextCursor: 'c1',
      }),
      'GET /api/sessions/history?cursor=c1': jsonResponse({
        items: [],
        nextCursor: null,
      }),
    });
    const queryClient = new QueryClient();
    const options = sessionHistoryQueryOptions();

    await queryClient.fetchInfiniteQuery({ ...options, pages: 3 });

    expect(requests.map((request) => request.path)).toEqual([
      '/api/sessions/history',
      '/api/sessions/history?cursor=c1',
    ]);
  });

  it('[TC-05-03] history query does not retry a 4xx', async () => {
    const { requests } = mockApi({
      'GET /api/sessions/history': errorResponse(
        403,
        ERROR_CODES.CONSENT_REQUIRED,
      ),
    });

    await expect(
      new QueryClient().fetchInfiniteQuery({
        ...sessionHistoryQueryOptions(),
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(requests).toHaveLength(1);
  });

  it('[TC-05-03] history query retries a server error once', async () => {
    const queue = [
      errorResponse(500, 'BOOM'),
      jsonResponse({ items: [], nextCursor: null }),
    ];
    const { requests } = mockApi({
      'GET /api/sessions/history': () =>
        queue.shift() ?? errorResponse(500, 'RESPONSES_EXHAUSTED'),
    });

    await new QueryClient().fetchInfiniteQuery({
      ...sessionHistoryQueryOptions(),
      retryDelay: 0,
    });

    expect(requests).toHaveLength(2);
  });
});
