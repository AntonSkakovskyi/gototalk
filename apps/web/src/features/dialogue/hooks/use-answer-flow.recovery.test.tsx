import { ERROR_CODES } from '@gototalk/shared';
import { act, waitFor } from '@testing-library/react';
import { analysisOk, mockDialogueApi } from '@/shared/testing/dialogue-mocks';
import {
  ANSWER_TEXT,
  PENDING,
  TURN,
  analysisRequests,
  deferred,
  setup,
  withAnswered,
} from '@/shared/testing/answer-flow-setup';
import {
  errorResponse,
  jsonResponse,
  testSessionDetails,
  testUtterance,
} from '@/shared/testing/test-fixtures';

describe('useAnswerFlow recovery', () => {
  it('[TC-04-08] recovers an unanswered utterance on load with exactly one request under StrictMode', async () => {
    const { cached, render } = setup(withAnswered());
    const api = mockDialogueApi();
    const { result } = render();

    await waitFor(() => expect(cached()?.utterances).toHaveLength(3));

    expect(result.current.phase).toBe('idle');
    expect(analysisRequests(api.requests)).toHaveLength(1);
    expect(api.answerRequests()).toHaveLength(0);
    expect(cached()?.utterances.at(-1)).toEqual(TURN.reply);
  });

  it('[TC-04-12] shows the analyzing phase while the recovery request is in flight', async () => {
    const { render } = setup(withAnswered());
    const analysis = deferred();
    mockDialogueApi({ analyze: () => analysis.promise });
    const { result } = render();

    await waitFor(() => expect(result.current.phase).toBe('analyzing'));

    analysis.resolve(analysisOk());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
  });

  it('[TC-04-08] recovers a pending utterance that already has a reply', async () => {
    const reply = TURN.reply ?? testUtterance();
    const { cached, render } = setup(withAnswered(reply));
    const api = mockDialogueApi();
    render();

    await waitFor(() =>
      expect(cached()?.utterances[1]?.analysisStatus).toBe('done'),
    );

    expect(analysisRequests(api.requests)).toHaveLength(1);
    expect(cached()?.utterances).toHaveLength(3);
  });

  it('[TC-04-08] a failed recovery does not loop and leaves the retry action', async () => {
    const { cached, render } = setup(withAnswered());
    let calls = 0;
    const api = mockDialogueApi({
      analyze: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    const { result, rerender } = render();

    await waitFor(() => expect(result.current.analysisError).not.toBeNull());
    rerender();
    await act(async () => undefined);
    expect(analysisRequests(api.requests)).toHaveLength(1);

    act(() => result.current.retryAnalysis());

    await waitFor(() => expect(cached()?.utterances).toHaveLength(3));
    expect(analysisRequests(api.requests)).toHaveLength(2);
    expect(result.current.analysisError).toBeNull();
  });

  it('[TC-04-08] does not recover for a finished session', async () => {
    const finished = {
      ...withAnswered(),
      status: 'finished' as const,
      endedAt: '2026-11-13T10:30:00.000Z',
    };
    const { render } = setup(finished);
    const api = mockDialogueApi();
    const { result } = render();

    await act(async () => undefined);

    expect(result.current.phase).toBe('idle');
    expect(api.requests).toHaveLength(0);
  });

  it('[TC-04-08] does not recover when the last utterance is a question and everything is analysed', async () => {
    const reply = TURN.reply ?? testUtterance();
    const { render } = setup(
      testSessionDetails({
        utterances: [testUtterance(), TURN.utterance, reply],
      }),
    );
    const api = mockDialogueApi();
    render();

    await act(async () => undefined);

    expect(api.requests).toHaveLength(0);
  });

  it('[TC-04-04] a submitted answer is not analysed a second time by the recovery', async () => {
    const { render } = setup();
    const api = mockDialogueApi({ answer: () => jsonResponse(PENDING, 201) });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));

    expect(analysisRequests(api.requests)).toHaveLength(1);
  });
});
