import { ERROR_CODES } from '@gototalk/shared';
import { act, waitFor } from '@testing-library/react';
import {
  DIALOGUE_SESSION_ID,
  analysisOk,
  mockDialogueApi,
} from '@/shared/testing/dialogue-mocks';
import {
  ANSWER_TEXT,
  PENDING,
  TURN,
  analysisRequests,
  deferred,
  setup,
} from '@/shared/testing/answer-flow-setup';
import {
  errorResponse,
  jsonResponse,
  testUtterance,
} from '@/shared/testing/test-fixtures';

const ANALYSIS_PATH = `/api/sessions/${DIALOGUE_SESSION_ID}/utterances/${PENDING.id}/analysis`;

describe('useAnswerFlow', () => {
  it('[TC-04-04] posts the answer, then analyses the returned utterance and stores the turn', async () => {
    const { cached, render } = setup();
    const api = mockDialogueApi({ answer: () => jsonResponse(PENDING, 201) });
    const { result } = render();

    let accepted = false;
    await act(async () => {
      accepted = await result.current.submit(ANSWER_TEXT);
    });

    expect(accepted).toBe(true);
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(api.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      `POST /api/sessions/${DIALOGUE_SESSION_ID}/utterances`,
      `POST ${ANALYSIS_PATH}`,
    ]);
    expect(api.answerRequests()).toEqual([{ text: ANSWER_TEXT }]);
    expect(cached()?.utterances).toEqual([
      testUtterance(),
      TURN.utterance,
      TURN.reply,
    ]);
    expect(cached()?.planRemaining).toBe(TURN.planRemaining);
  });

  it('[TC-04-12] moves through sending and analyzing with the pending utterance visible in between', async () => {
    const { cached, render } = setup();
    const answer = deferred();
    const analysis = deferred();
    mockDialogueApi({
      answer: () => answer.promise,
      analyze: () => analysis.promise,
    });
    const { result } = render();

    act(() => {
      void result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() => expect(result.current.phase).toBe('sending'));
    expect(cached()?.utterances).toHaveLength(1);

    answer.resolve(jsonResponse(PENDING, 201));
    await waitFor(() => expect(result.current.phase).toBe('analyzing'));
    expect(result.current.analyzingUtteranceId).toBe(PENDING.id);
    expect(cached()?.utterances.at(-1)).toEqual(PENDING);

    analysis.resolve(analysisOk());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(cached()?.utterances.at(-2)).toEqual(TURN.utterance);
    expect(cached()?.utterances.at(-1)).toEqual(TURN.reply);
  });

  it('[TC-04-08] a failed first step keeps the text with the form and sends no analysis', async () => {
    const { cached, render } = setup();
    const api = mockDialogueApi({
      answer: () => errorResponse(409, ERROR_CODES.ANSWER_NOT_EXPECTED),
    });
    const { result } = render();

    let accepted = true;
    await act(async () => {
      accepted = await result.current.submit(ANSWER_TEXT);
    });

    expect(accepted).toBe(false);
    await waitFor(() =>
      expect(result.current.submitError).toMatchObject({
        status: 409,
        code: ERROR_CODES.ANSWER_NOT_EXPECTED,
      }),
    );
    expect(result.current.phase).toBe('idle');
    expect(analysisRequests(api.requests)).toHaveLength(0);
    expect(cached()?.utterances).toHaveLength(1);
  });

  it('[TC-04-08] the submit error clears when a new attempt succeeds', async () => {
    const { render } = setup();
    let calls = 0;
    mockDialogueApi({
      answer: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : jsonResponse(PENDING, 201),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });
    await waitFor(() =>
      expect(result.current.submitError).toMatchObject({ status: 503 }),
    );

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });

    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.submitError).toBeNull();
  });

  it('[TC-04-08] a failed analysis keeps the utterance and retry sends only the analysis', async () => {
    const { cached, render } = setup();
    let calls = 0;
    const api = mockDialogueApi({
      answer: () => jsonResponse(PENDING, 201),
      analyze: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    const { result } = render();

    let accepted = false;
    await act(async () => {
      accepted = await result.current.submit(ANSWER_TEXT);
    });

    expect(accepted).toBe(true);
    await waitFor(() => expect(result.current.analysisError).not.toBeNull());
    expect(result.current.analysisError).toMatchObject({
      status: 503,
      code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.analyzingUtteranceId).toBe(PENDING.id);
    expect(cached()?.utterances.at(-1)).toEqual(PENDING);

    act(() => result.current.retryAnalysis());

    await waitFor(() => expect(result.current.analysisError).toBeNull());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(api.answerRequests()).toHaveLength(1);
    expect(analysisRequests(api.requests)).toHaveLength(2);
    expect(cached()?.utterances.at(-1)).toEqual(TURN.reply);
  });

  it('[TC-04-08] a 502 invalid model response surfaces its code', async () => {
    const { render } = setup();
    mockDialogueApi({
      answer: () => jsonResponse(PENDING, 201),
      analyze: () =>
        errorResponse(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submit(ANSWER_TEXT);
    });

    await waitFor(() =>
      expect(result.current.analysisError).toMatchObject({
        status: 502,
        code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      }),
    );
  });
});
