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
  testMistake,
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import { useMarkMistake } from './use-mark-mistake';

const DETAILS_KEY = sessionKeys.details(DIALOGUE_SESSION_ID);
const DETAILS = testSessionDetails({
  utterances: [testUtterance(), testTurnResult().utterance],
});

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), DETAILS);
  const { result } = renderHook(() => useMarkMistake(DIALOGUE_SESSION_ID), {
    wrapper: createQueryWrapper(queryClient),
  });
  const cachedMistake = () =>
    queryClient.getQueryData<SessionDetails>(
      sessionKeys.details(DIALOGUE_SESSION_ID),
    )?.utterances[1]?.mistakes[0];
  return { queryClient, result, cachedMistake };
}

describe('useMarkMistake', () => {
  it('[TC-04-04] marks the mistake as false and updates it in the cache', async () => {
    const { result, cachedMistake } = setup();
    const api = mockDialogueApi();

    act(() => result.current.mark(testMistake().id));

    await waitFor(() => expect(cachedMistake()?.isFalse).toBe(true));
    expect(api.markMistakeRequests()).toEqual([{ isFalse: true }]);
    expect(result.current.error).toBeNull();
  });

  it('[TC-04-04] reports pending only for the mistake being marked', async () => {
    const { result } = setup();
    let release: (response: Response) => void = () => undefined;
    mockDialogueApi({
      markMistake: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });

    act(() => result.current.mark(testMistake().id));

    await waitFor(() =>
      expect(result.current.isPendingFor(testMistake().id)).toBe(true),
    );
    expect(result.current.isPendingFor('other-id')).toBe(false);

    release(new Response(JSON.stringify(testMistake({ isFalse: true }))));
    await waitFor(() =>
      expect(result.current.isPendingFor(testMistake().id)).toBe(false),
    );
  });

  it('[TC-04-08] keeps the cache and exposes the error when marking fails', async () => {
    const { result, cachedMistake } = setup();
    mockDialogueApi({
      markMistake: () => errorResponse(404, ERROR_CODES.MISTAKE_NOT_FOUND),
    });

    act(() => result.current.mark(testMistake().id));

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        status: 404,
        code: ERROR_CODES.MISTAKE_NOT_FOUND,
      }),
    );
    expect(cachedMistake()?.isFalse).toBe(false);
  });

  it('[TC-04-04] a late details refetch does not overwrite the marked mistake', async () => {
    const { queryClient, result, cachedMistake } = setup();
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
    await waitFor(() =>
      expect(queryClient.isFetching({ queryKey: DETAILS_KEY })).toBe(1),
    );

    act(() => result.current.mark(testMistake().id));
    await waitFor(() => expect(cachedMistake()?.isFalse).toBe(true));
    release(jsonResponse(DETAILS));
    await act(async () => undefined);

    expect(cachedMistake()?.isFalse).toBe(true);
  });

  it('[TC-04-04] invalidates the cached report after a successful mark', async () => {
    const { queryClient, result } = setup();
    const reportKey = sessionKeys.report(DIALOGUE_SESSION_ID);
    queryClient.setQueryData(reportKey, { id: 'report' });
    mockDialogueApi();

    act(() => result.current.mark(testMistake().id));

    await waitFor(() =>
      expect(queryClient.getQueryState(reportKey)?.isInvalidated).toBe(true),
    );
  });

  it('[TC-04-08] leaves the cached report valid when marking fails', async () => {
    const { queryClient, result } = setup();
    const reportKey = sessionKeys.report(DIALOGUE_SESSION_ID);
    queryClient.setQueryData(reportKey, { id: 'report' });
    mockDialogueApi({
      markMistake: () => errorResponse(404, ERROR_CODES.MISTAKE_NOT_FOUND),
    });

    act(() => result.current.mark(testMistake().id));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(queryClient.getQueryState(reportKey)?.isInvalidated).toBe(false);
  });
});
