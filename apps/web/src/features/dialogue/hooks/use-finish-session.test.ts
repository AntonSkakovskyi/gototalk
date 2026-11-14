import { ERROR_CODES, type SessionDetails } from '@gototalk/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/shared/api/session-details';
import {
  DIALOGUE_SESSION_ID,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testSessionPlan,
} from '@/shared/testing/test-fixtures';
import { useFinishSession } from './use-finish-session';

const DETAILS = testSessionDetails();

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), DETAILS);
  queryClient.setQueryData(sessionKeys.list(), []);
  queryClient.setQueryData(sessionKeys.plan({ previousTopics: [] }), {
    ...testSessionPlan(),
  });
  const { result } = renderHook(() => useFinishSession(DIALOGUE_SESSION_ID), {
    wrapper: createQueryWrapper(queryClient),
  });
  const cachedDetails = () =>
    queryClient.getQueryData<SessionDetails>(
      sessionKeys.details(DIALOGUE_SESSION_ID),
    );
  return { queryClient, result, cachedDetails };
}

describe('useFinishSession', () => {
  it('[TC-04-04] stores the finished session, invalidates the list only and calls back', async () => {
    const { queryClient, result, cachedDetails } = setup();
    const api = mockDialogueApi();
    const onFinished = vi.fn();

    act(() => result.current.finish(onFinished));

    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(api.finishRequests()).toHaveLength(1);
    expect(cachedDetails()).toMatchObject({
      status: 'finished',
      endedAt: '2026-11-13T10:30:00.000Z',
      utterances: DETAILS.utterances,
      planRemaining: DETAILS.planRemaining,
    });
    expect(queryClient.getQueryState(sessionKeys.list())?.isInvalidated).toBe(
      true,
    );
    expect(
      queryClient.getQueryState(sessionKeys.plan({ previousTopics: [] }))
        ?.isInvalidated,
    ).toBe(false);
  });

  it('[TC-04-04] reports finishing while the request is in flight', async () => {
    const { result } = setup();
    let release: (response: Response) => void = () => undefined;
    mockDialogueApi({
      finish: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });

    act(() => result.current.finish(vi.fn()));

    await waitFor(() => expect(result.current.isFinishing).toBe(true));
    release(
      new Response(JSON.stringify({ ...DETAILS, status: 'finished' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await waitFor(() => expect(result.current.isFinishing).toBe(false));
  });

  it('[TC-04-08] a failure keeps the cache, skips the callback and exposes the error', async () => {
    const { queryClient, result, cachedDetails } = setup();
    mockDialogueApi({
      finish: () => errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND),
    });
    const onFinished = vi.fn();

    act(() => result.current.finish(onFinished));

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        status: 404,
        code: ERROR_CODES.SESSION_NOT_FOUND,
      }),
    );
    expect(onFinished).not.toHaveBeenCalled();
    expect(cachedDetails()).toEqual(DETAILS);
    expect(queryClient.getQueryState(sessionKeys.list())?.isInvalidated).toBe(
      false,
    );
  });

  it('[TC-04-04] a late details refetch does not overwrite the finished session', async () => {
    const { queryClient, result, cachedDetails } = setup();
    let release: (response: Response) => void = () => undefined;
    mockDialogueApi({
      details: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });
    void queryClient.fetchQuery({
      ...sessionDetailsQueryOptions(DIALOGUE_SESSION_ID),
      staleTime: 0,
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(1));

    act(() => result.current.finish(vi.fn()));
    await waitFor(() => expect(cachedDetails()?.status).toBe('finished'));
    release(jsonResponse(DETAILS));
    await act(async () => undefined);

    expect(cachedDetails()?.status).toBe('finished');
  });
});
