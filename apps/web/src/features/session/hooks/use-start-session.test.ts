import { ERROR_CODES } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { mockApi } from '@/shared/testing/mock-api';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import {
  testSession,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/fixtures/session';
import { sessionListQueryOptions } from '@/features/session/api/session-queries';
import { sessionKeys } from '@/shared/api/session-details';
import { useStartSession } from './use-start-session';

const REQUEST = { ...testSessionPlan(), feedbackMode: 'immediate' as const };
const PREVIOUS = testSession({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0002',
  topic: 'My hometown',
});
const STARTED = testSessionDetails({
  id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0003',
});

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.list(), [PREVIOUS]);
  return { queryClient, wrapper: createQueryWrapper(queryClient) };
}

function startedList() {
  return [
    testSession({ id: STARTED.id }),
    { ...PREVIOUS, status: 'finished' as const },
  ];
}

describe('useStartSession', () => {
  it('[TC-03-03] refetches the observed list with the new session first', async () => {
    const { wrapper } = setup();
    const { requests } = mockApi({
      'POST /api/sessions': jsonResponse(STARTED, 201),
      'GET /api/sessions': jsonResponse(startedList()),
    });
    const { result } = renderHook(
      () => ({
        start: useStartSession(),
        list: useQuery(sessionListQueryOptions()),
      }),
      { wrapper },
    );

    result.current.start.mutate(REQUEST);

    await waitFor(() =>
      expect(result.current.list.data?.map((item) => item.id)).toEqual([
        STARTED.id,
        PREVIOUS.id,
      ]),
    );
    expect(result.current.list.data?.map((item) => item.status)).toEqual([
      'active',
      'finished',
    ]);
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual(
      REQUEST,
    );
  });

  it('[TC-03-03] drops the cached list when nothing observes it', async () => {
    const { queryClient, wrapper } = setup();
    mockApi({ 'POST /api/sessions': jsonResponse(STARTED, 201) });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(sessionKeys.list())).toBeUndefined();
  });

  it('[TC-03-03] invalidates the details of other sessions and keeps the new ones readable', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(sessionKeys.details(PREVIOUS.id), {
      ...PREVIOUS,
      utterances: [],
    });
    const { requests } = mockApi({
      'POST /api/sessions': jsonResponse(STARTED, 201),
    });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryState(sessionKeys.details(PREVIOUS.id))
        ?.isInvalidated,
    ).toBe(true);
    const seeded = queryClient.getQueryState(sessionKeys.details(STARTED.id));
    expect(seeded?.isInvalidated).toBe(false);
    expect(seeded?.data).toEqual(STARTED);
    expect(requests).toHaveLength(1);
  });

  it('[TC-03-03] does not invalidate the plan', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(sessionKeys.plan({ previousTopics: [] }), {
      ...testSessionPlan(),
    });
    mockApi({ 'POST /api/sessions': jsonResponse(STARTED, 201) });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryState(sessionKeys.plan({ previousTopics: [] }))
        ?.isInvalidated,
    ).toBe(false);
  });

  it('[TC-03-03] a failed start surfaces the error and still resets the list', async () => {
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
    expect(queryClient.getQueryData(sessionKeys.list())).toBeUndefined();
  });

  it('[TC-05-03] invalidates the history so the new session appears there', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(sessionKeys.history(), {
      pages: [{ items: [PREVIOUS], nextCursor: null }],
      pageParams: [undefined],
    });
    mockApi({ 'POST /api/sessions': jsonResponse(STARTED, 201) });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryState(sessionKeys.history())?.isInvalidated,
    ).toBe(true);
  });

  it('[TC-05-03] a failed start still invalidates the history', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(sessionKeys.history(), {
      pages: [{ items: [PREVIOUS], nextCursor: null }],
      pageParams: [undefined],
    });
    mockApi({
      'POST /api/sessions': errorResponse(403, ERROR_CODES.CONSENT_REQUIRED),
    });
    const { result } = renderHook(() => useStartSession(), { wrapper });

    result.current.mutate(REQUEST);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(
      queryClient.getQueryState(sessionKeys.history())?.isInvalidated,
    ).toBe(true);
  });
});
