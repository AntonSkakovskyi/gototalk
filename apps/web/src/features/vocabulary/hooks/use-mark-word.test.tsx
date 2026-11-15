import {
  ERROR_CODES,
  type SessionReport,
  type WordPage,
} from '@gototalk/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { sessionKeys } from '@/entities/session/api/session-details';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '@/shared/testing/query-wrapper';
import { errorResponse } from '@/shared/testing/http-responses';
import { testReport } from '@/shared/testing/fixtures/report';
import { testWord } from '@/shared/testing/fixtures/words';
import { mockWordsApi } from '@/shared/testing/words-mocks';
import { wordKeys } from '@/features/vocabulary/api/words-queries';
import { useMarkWord } from './use-mark-word';

const WORD = testWord();
const OTHER = testWord({ id: '4a8d3e27-1b5c-4c9d-9e6f-7a2b8c1d0002' });
const REPORT = testReport({ words: [WORD, OTHER] });
const REPORT_KEY = sessionKeys.report(REPORT.sessionId);
const OTHER_REPORT_KEY = sessionKeys.report('other-session');
const OTHER_REPORT = testReport({ words: [OTHER] });
const LIST_KEY = [...wordKeys.list(), 'all'];

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(REPORT_KEY, REPORT);
  queryClient.setQueryData(OTHER_REPORT_KEY, OTHER_REPORT);
  const { result } = renderHook(() => useMarkWord(), {
    wrapper: createQueryWrapper(queryClient),
  });
  const reportWord = () =>
    queryClient
      .getQueryData<SessionReport>(REPORT_KEY)
      ?.words.find((word) => word.id === WORD.id);
  return { queryClient, result, reportWord };
}

describe('useMarkWord', () => {
  it('[TC-05-05] patches the word and updates it in the cached report', async () => {
    const { result, reportWord } = setup();
    const api = mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() => expect(reportWord()?.state).toBe('passive'));
    expect(api.markRequests()).toEqual([
      { id: WORD.id, body: { state: 'passive' } },
    ]);
    expect(result.current.errorFor(WORD.id)).toBeNull();
  });

  it('[TC-05-05] leaves reports without the word untouched', async () => {
    const { queryClient, result, reportWord } = setup();
    mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() => expect(reportWord()?.state).toBe('passive'));
    expect(queryClient.getQueryData(OTHER_REPORT_KEY)).toBe(OTHER_REPORT);
  });

  it('[TC-05-05] updates the word in every cached report that contains it', async () => {
    const { queryClient, result } = setup();
    queryClient.setQueryData(
      OTHER_REPORT_KEY,
      testReport({ words: [WORD, OTHER] }),
    );
    mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'partial'));

    await waitFor(() =>
      expect(
        queryClient.getQueryData<SessionReport>(OTHER_REPORT_KEY)?.words[0]
          ?.state,
      ).toBe('partial'),
    );
  });

  it('[TC-05-05] updates the word in a cached words list', async () => {
    const { queryClient, result } = setup();
    const list: InfiniteData<WordPage> = {
      pages: [{ items: [OTHER, WORD], nextCursor: null }],
      pageParams: [null],
    };
    queryClient.setQueryData(LIST_KEY, list);
    mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() =>
      expect(
        queryClient.getQueryData<InfiniteData<WordPage>>(LIST_KEY)?.pages[0]
          ?.items[1]?.state,
      ).toBe('passive'),
    );
  });

  it('[TC-05-05] invalidates the cached reports and words lists after a successful mark', async () => {
    const { queryClient, result } = setup();
    queryClient.setQueryData(LIST_KEY, { pages: [], pageParams: [] });
    mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() =>
      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(REPORT_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(OTHER_REPORT_KEY)?.isInvalidated).toBe(
      true,
    );
  });

  it('[TC-05-03] sends nothing when the word already has the chosen state', async () => {
    const { result } = setup();
    const api = mockWordsApi({ words: [WORD, OTHER] });

    act(() => result.current.mark(WORD, 'new'));
    await act(async () => undefined);

    expect(api.requests).toEqual([]);
  });

  it('[TC-05-05] reports pending only for the word being marked', async () => {
    const { result } = setup();
    let release: (response: Response) => void = () => undefined;
    mockWordsApi({
      words: [WORD, OTHER],
      mark: () =>
        new Promise<Response>((done) => {
          release = done;
        }),
    });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() =>
      expect(result.current.isPendingFor(WORD.id)).toBe(true),
    );
    expect(result.current.isPendingFor(OTHER.id)).toBe(false);

    release(new Response(JSON.stringify({ ...WORD, state: 'passive' })));
    await waitFor(() =>
      expect(result.current.isPendingFor(WORD.id)).toBe(false),
    );
  });

  it('[TC-05-05] keeps the cache and exposes the error for that word only when marking fails', async () => {
    const { queryClient, result, reportWord } = setup();
    queryClient.setQueryData(LIST_KEY, { pages: [], pageParams: [] });
    mockWordsApi({
      words: [WORD, OTHER],
      mark: () => errorResponse(409, ERROR_CODES.WORD_ALREADY_ACTIVE),
    });

    act(() => result.current.mark(WORD, 'passive'));

    await waitFor(() =>
      expect(result.current.errorFor(WORD.id)).toMatchObject({
        status: 409,
        code: ERROR_CODES.WORD_ALREADY_ACTIVE,
      }),
    );
    expect(result.current.errorFor(OTHER.id)).toBeNull();
    expect(reportWord()?.state).toBe('new');
    expect(queryClient.getQueryState(REPORT_KEY)?.isInvalidated).toBe(false);
  });

  it('[TC-05-05] discards a report fetch that started before the mark and resolves after it', async () => {
    const { queryClient, result, reportWord } = setup();
    mockWordsApi({ words: [WORD, OTHER] });
    let resolveStale: (report: SessionReport) => void = () => undefined;
    const stale = queryClient
      .fetchQuery({
        queryKey: REPORT_KEY,
        queryFn: () =>
          new Promise<SessionReport>((done) => {
            resolveStale = done;
          }),
      })
      .catch(() => undefined);

    act(() => result.current.mark(WORD, 'passive'));
    await waitFor(() =>
      expect(queryClient.getQueryState(REPORT_KEY)?.isInvalidated).toBe(true),
    );
    expect(reportWord()?.state).toBe('passive');

    resolveStale(REPORT);
    await act(async () => {
      await stale;
    });

    expect(reportWord()?.state).toBe('passive');
  });
});
