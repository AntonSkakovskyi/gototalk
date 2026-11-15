import { ERROR_CODES } from '@gototalk/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  HINT_PHRASE,
  HINT_TRANSLATION,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { DIALOGUE_SESSION_ID } from '@/entities/session/testing/session-entity-mocks';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { useHint } from './use-hint';

function setup() {
  const queryClient = createTestQueryClient();
  const { result } = renderHook(() => useHint(DIALOGUE_SESSION_ID), {
    wrapper: createQueryWrapper(queryClient),
  });
  return { queryClient, result };
}

describe('useHint', () => {
  it('[TC-04-05] requests a phrase start and exposes the phrase', async () => {
    const { result } = setup();
    const api = mockDialogueApi();

    act(() => result.current.phraseStart());

    await waitFor(() =>
      expect(result.current.data).toEqual({
        kind: 'phrase_start',
        text: HINT_PHRASE,
      }),
    );
    expect(api.hintRequests()).toEqual([{ kind: 'phrase_start' }]);
    expect(result.current.error).toBeNull();
  });

  it('[TC-04-10] translates a word and remembers the request that produced the result', async () => {
    const { result } = setup();
    const api = mockDialogueApi();

    act(() => result.current.translate('зустріч'));

    await waitFor(() =>
      expect(result.current.data).toEqual({
        kind: 'translation',
        word: HINT_TRANSLATION,
      }),
    );
    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
    ]);
    expect(result.current.request).toEqual({
      kind: 'translation',
      word: 'зустріч',
    });
  });

  it('[TC-04-10] is pending while the request is in flight', async () => {
    const { result } = setup();
    let release: (response: Response) => void = () => undefined;
    mockDialogueApi({
      hint: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });

    act(() => result.current.phraseStart());
    await waitFor(() => expect(result.current.isPending).toBe(true));

    release(jsonResponse({ kind: 'phrase_start', text: HINT_PHRASE }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('[TC-04-10] exposes the error and repeats the failed request on retry', async () => {
    const { result } = setup();
    let calls = 0;
    const api = mockDialogueApi({
      hint: () => {
        calls += 1;
        return calls === 1
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : jsonResponse({ kind: 'translation', word: HINT_TRANSLATION });
      },
    });

    act(() => result.current.translate('зустріч'));
    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        status: 503,
        code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
      }),
    );
    expect(result.current.data).toBeUndefined();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(api.hintRequests()).toEqual([
      { kind: 'translation', word: 'зустріч' },
      { kind: 'translation', word: 'зустріч' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('[TC-04-10] retry does nothing before any request', () => {
    const { result } = setup();
    const api = mockDialogueApi();

    act(() => result.current.retry());

    expect(api.hintRequests()).toEqual([]);
  });

  it('[TC-04-05] reset clears the result and the error', async () => {
    const { result } = setup();
    mockDialogueApi();
    act(() => result.current.phraseStart());
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(result.current.request).toBeUndefined();
  });

  it('[TC-04-10] does not cache the result as server state', async () => {
    const { result, queryClient } = setup();
    mockDialogueApi();

    act(() => result.current.phraseStart());
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
