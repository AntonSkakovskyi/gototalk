import { ERROR_CODES } from '@gototalk/shared';
import { act, waitFor } from '@testing-library/react';
import { analysisOk, mockDialogueApi } from '@/shared/testing/dialogue-mocks';
import {
  ANSWER_TEXT,
  PENDING,
  analysisRequests,
  setup,
  withAnswered,
} from '@/shared/testing/answer-flow-setup';
import { errorResponse, jsonResponse } from '@/shared/testing/test-fixtures';

const FINISHED = {
  ...withAnswered(),
  status: 'finished' as const,
  endedAt: '2026-11-13T10:30:00.000Z',
};

describe('useAnswerFlow errors', () => {
  it('[TC-04-08] a rejected new submit keeps the failed analysis and its retry', async () => {
    const { cached, render } = setup();
    let analyzed = 0;
    let answered = 0;
    const api = mockDialogueApi({
      answer: () =>
        answered++ === 0
          ? jsonResponse(PENDING, 201)
          : errorResponse(409, ERROR_CODES.ANSWER_NOT_EXPECTED),
      analyze: () =>
        analyzed++ === 0
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
      details: () => jsonResponse(withAnswered()),
    });
    const { result } = render();
    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.analysisError).not.toBeNull());

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.submitError).not.toBeNull());

    expect(result.current.analysisError).toMatchObject({ status: 503 });
    expect(result.current.analyzingUtteranceId).toBe(PENDING.id);
    act(() => result.current.retryAnalysis());
    await waitFor(() => expect(cached()?.utterances).toHaveLength(3));
    expect(analysisRequests(api.requests)).toHaveLength(2);
  });

  it('[TC-04-08] a 409 on step 1 refreshes the cached details', async () => {
    const { cached, render } = setup();
    const api = mockDialogueApi({
      answer: () => errorResponse(409, ERROR_CODES.SESSION_FINISHED),
      details: () => jsonResponse(FINISHED),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });

    await waitFor(() => expect(cached()?.status).toBe('finished'));
    expect(api.requests.filter((r) => r.method === 'GET')).toHaveLength(1);
  });

  it('[TC-04-08] a non-409 failure on step 1 does not refetch the details', async () => {
    const { render } = setup();
    const api = mockDialogueApi({
      answer: () => errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await act(async () => undefined);

    expect(api.requests.filter((r) => r.method === 'GET')).toHaveLength(0);
  });

  it('[TC-04-08] retry is offered for a transient analysis failure', async () => {
    const { render } = setup();
    mockDialogueApi({
      analyze: () => errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE),
    });
    const { result } = render();
    expect(result.current.canRetryAnalysis).toBe(false);

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });

    await waitFor(() => expect(result.current.canRetryAnalysis).toBe(true));
  });

  it('[TC-04-08] retry is not offered when the analysis target is gone (404)', async () => {
    const { render } = setup();
    const api = mockDialogueApi({
      analyze: () => errorResponse(404, ERROR_CODES.UTTERANCE_NOT_FOUND),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.analysisError).not.toBeNull());

    expect(result.current.canRetryAnalysis).toBe(false);
    act(() => result.current.retryAnalysis());
    await act(async () => undefined);
    expect(analysisRequests(api.requests)).toHaveLength(1);
  });
});
