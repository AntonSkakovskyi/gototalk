import { ERROR_CODES } from '@gototalk/shared';
import { act, configure, waitFor } from '@testing-library/react';
import {
  PENDING,
  TURN,
  analysisRequests,
  setup,
  withAnswered,
} from '@/features/dialogue/testing/answer-flow-setup';
import { deferred } from '@/shared/testing/deferred';
import {
  analysisOk,
  mockDialogueApi,
} from '@/features/dialogue/testing/dialogue-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testUtterance } from '@/shared/testing/fixtures/session';

const SLOW_MS = 5000;

// Recording state arrives through async media events, which lag under CPU load.
configure({ asyncUtilTimeout: SLOW_MS });
vi.setConfig({ testTimeout: SLOW_MS * 3 });

function voice() {
  return new Blob(['voice'], { type: 'audio/webm;codecs=opus' });
}

describe('useAnswerFlow voice branch', () => {
  it('[TC-04-12] moves through recognizing and analyzing and stores the turn', async () => {
    const { cached, render } = setup();
    const recognition = deferred();
    const analysis = deferred();
    const api = mockDialogueApi({
      voiceAnswer: () => recognition.promise,
      analyze: () => analysis.promise,
    });
    const { result } = render();

    act(() => {
      void result.current.submitAudio(voice());
    });
    await waitFor(() => expect(result.current.phase).toBe('recognizing'));
    expect(cached()?.utterances).toHaveLength(1);

    recognition.resolve(jsonResponse(PENDING, 201));
    await waitFor(() => expect(result.current.phase).toBe('analyzing'));
    expect(cached()?.utterances.at(-1)).toEqual(PENDING);

    analysis.resolve(analysisOk());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(cached()?.utterances).toEqual([
      testUtterance(),
      TURN.utterance,
      TURN.reply,
    ]);
    expect(api.audioRequests()).toHaveLength(1);
    expect(analysisRequests(api.requests)).toHaveLength(1);
  });

  it('[TC-04-05] reports success and keeps nothing to retry afterwards', async () => {
    const { render } = setup();
    mockDialogueApi({ voiceAnswer: () => jsonResponse(PENDING, 201) });
    const { result } = render();

    let accepted = false;
    await act(async () => {
      accepted = await result.current.submitAudio(voice());
    });

    expect(accepted).toBe(true);
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.canRetrySend).toBe(false);
    expect(result.current.audioFailed).toBe(false);
  });

  it('[TC-04-08] an unavailable recognition keeps the recording and retry re-sends the same blob', async () => {
    const { cached, render } = setup();
    let calls = 0;
    const api = mockDialogueApi({
      voiceAnswer: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE)
          : jsonResponse(PENDING, 201),
    });
    const { result } = render();

    let accepted = true;
    await act(async () => {
      accepted = await result.current.submitAudio(voice());
    });

    expect(accepted).toBe(false);
    await waitFor(() => expect(result.current.canRetrySend).toBe(true));
    expect(result.current.audioFailed).toBe(true);
    expect(result.current.submitError).toMatchObject({
      status: 503,
      code: ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
    });
    expect(result.current.phase).toBe('idle');
    expect(analysisRequests(api.requests)).toHaveLength(0);
    expect(cached()?.utterances).toHaveLength(1);

    await act(async () => {
      await result.current.retrySend();
    });

    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.submitError).toBeNull();
    const [first, second] = api.audioRequests();
    expect(api.audioRequests()).toHaveLength(2);
    await expect(second?.text()).resolves.toBe(await first?.text());
    expect(second?.type).toBe(first?.type);
    expect(cached()?.utterances.at(-1)).toEqual(TURN.reply);
    expect(result.current.canRetrySend).toBe(false);
  });

  it.each([
    [413, ERROR_CODES.AUDIO_TOO_LARGE],
    [415, ERROR_CODES.AUDIO_UNSUPPORTED],
  ])(
    '[TC-04-08] a %i %s is not retryable and sends nothing on retry',
    async (status, code) => {
      const { render } = setup();
      const api = mockDialogueApi({
        voiceAnswer: () => errorResponse(status, code),
      });
      const { result } = render();

      await act(async () => {
        await result.current.submitAudio(voice());
      });

      await waitFor(() => expect(result.current.audioFailed).toBe(true));
      expect(result.current.canRetrySend).toBe(false);

      await act(async () => {
        await result.current.retrySend();
      });

      expect(api.audioRequests()).toHaveLength(1);
    },
  );

  it('[TC-04-08] a failed text answer offers no resend and is not an audio failure', async () => {
    const { render } = setup();
    mockDialogueApi({ answer: () => errorResponse(500, 'INTERNAL_ERROR') });
    const { result } = render();

    await act(async () => {
      await result.current.submit('I very like');
    });

    await waitFor(() => expect(result.current.submitError).not.toBeNull());
    expect(result.current.canRetrySend).toBe(false);
    expect(result.current.audioFailed).toBe(false);
  });

  it('[TC-04-08] a 409 on a resent recording clears the stale error and refreshes the details', async () => {
    const { cached, render } = setup();
    let calls = 0;
    const api = mockDialogueApi({
      voiceAnswer: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE)
          : errorResponse(409, ERROR_CODES.ANSWER_NOT_EXPECTED),
      details: () => jsonResponse(withAnswered()),
    });
    const { result } = render();
    await act(async () => {
      await result.current.submitAudio(voice());
    });
    await waitFor(() => expect(result.current.canRetrySend).toBe(true));

    await act(async () => {
      await result.current.retrySend();
    });

    await waitFor(() => expect(cached()?.utterances).toHaveLength(2));
    expect(api.audioRequests()).toHaveLength(2);
    expect(result.current.submitError).toBeNull();
    expect(result.current.audioFailed).toBe(false);
    expect(result.current.canRetrySend).toBe(false);
  });

  it('[TC-04-08] a failed recording is not kept in the mutation cache after the screen unmounts', async () => {
    const { queryClient, render } = setup();
    mockDialogueApi({
      voiceAnswer: () =>
        errorResponse(503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE),
    });
    const { result, unmount } = render();
    await act(async () => {
      await result.current.submitAudio(voice());
    });
    await waitFor(() => expect(result.current.audioFailed).toBe(true));
    expect(queryClient.getMutationCache().getAll()).not.toHaveLength(0);

    unmount();

    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0),
    );
  });

  it('[TC-04-08] a failed analysis after a voice answer reuses the analysis retry only', async () => {
    const { cached, render } = setup();
    let calls = 0;
    const api = mockDialogueApi({
      voiceAnswer: () => jsonResponse(PENDING, 201),
      analyze: () =>
        calls++ === 0
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    const { result } = render();

    await act(async () => {
      await result.current.submitAudio(voice());
    });

    await waitFor(() => expect(result.current.analysisError).not.toBeNull());
    expect(result.current.canRetrySend).toBe(false);
    expect(cached()?.utterances.at(-1)).toEqual(PENDING);

    act(() => result.current.retryAnalysis());

    await waitFor(() => expect(result.current.analysisError).toBeNull());
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(api.audioRequests()).toHaveLength(1);
    expect(analysisRequests(api.requests)).toHaveLength(2);
    expect(cached()?.utterances.at(-1)).toEqual(TURN.reply);
  });
});
