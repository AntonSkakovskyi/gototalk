import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeMedia } from '@/features/dialogue/testing/fake-media';
import uk from '@/shared/i18n/uk.json';
import { deferred } from '@/shared/testing/answer-flow-setup';
import { analysisOk, mockDialogueApi } from '@/shared/testing/dialogue-mocks';
import { errorResponse, jsonResponse } from '@/shared/testing/test-fixtures';
import {
  PENDING_ANSWER,
  REPLY,
  TURN,
  currentCard,
  renderScreen,
} from './dialogue-screen-test-helpers';

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  media = installFakeMedia();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(navigator, 'sendBeacon');
  Reflect.deleteProperty(URL, 'createObjectURL');
});

function spyOnLeaks() {
  const createObjectUrl = vi.fn<(blob: Blob) => string>();
  const sendBeacon = vi.fn<(url: string) => boolean>();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: sendBeacon,
  });
  return { createObjectUrl, sendBeacon };
}

async function recordAnswer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: uk.dialogue.voice.record }),
  );
  await screen.findByText(uk.dialogue.voice.indicator.recording);
  await user.click(
    screen.getByRole('button', { name: uk.dialogue.voice.stop }),
  );
}

describe('DialogueScreen voice answer', () => {
  it('[TC-04-05] takes a recording through recognition and analysis to the highlighted transcript and the next question', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi({
      voiceAnswer: () => jsonResponse(PENDING_ANSWER, 201),
    });
    renderScreen();

    await recordAnswer(user);

    expect(
      await screen.findByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
    expect(currentCard().getByText(REPLY.text)).toBeInTheDocument();
    expect(api.audioRequests()).toHaveLength(1);
    expect(api.requests.map((request) => request.path)).toEqual([
      expect.stringMatching(/\/utterances$/),
      expect.stringMatching(/\/utterances\/[^/]+\/analysis$/),
    ]);
    expect(media.streams[0]?.tracks.every((track) => track.stopped)).toBe(true);
  });

  it('[TC-04-05] sends the recording only as the upload and never plays it back', async () => {
    const user = userEvent.setup();
    const { createObjectUrl, sendBeacon } = spyOnLeaks();
    const api = mockDialogueApi({
      voiceAnswer: () => jsonResponse(PENDING_ANSWER, 201),
    });
    const { container } = renderScreen();

    await recordAnswer(user);
    await screen.findByRole('button', { name: 'go' });

    const [file] = api.audioRequests();
    expect(file?.name).toBe('answer.webm');
    expect(file?.type).toBe('audio/webm;codecs=opus');
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(container.querySelector('audio, video')).toBeNull();
  });

  it('[TC-04-12] announces recognizing, then analyzing, then nothing', async () => {
    const user = userEvent.setup();
    const recognition = deferred();
    const analysis = deferred();
    mockDialogueApi({
      voiceAnswer: () => recognition.promise,
      analyze: () => analysis.promise,
    });
    renderScreen();

    await recordAnswer(user);
    expect(
      await screen.findByText(uk.dialogue.status.recognizing),
    ).toBeVisible();
    expect(
      screen.queryByText(uk.dialogue.status.analyzing),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: uk.dialogue.voice.record }),
    ).toBeDisabled();

    recognition.resolve(jsonResponse(PENDING_ANSWER, 201));
    expect(await screen.findByText(uk.dialogue.status.analyzing)).toBeVisible();
    expect(
      screen.queryByText(uk.dialogue.status.recognizing),
    ).not.toBeInTheDocument();
    expect(screen.getByText(TURN.utterance.text)).toBeInTheDocument();

    analysis.resolve(analysisOk());
    await waitFor(() =>
      expect(
        screen.queryByText(uk.dialogue.status.analyzing),
      ).not.toBeInTheDocument(),
    );
  });

  it('[TC-04-08] keeps the recording when recognition is unavailable and resends the same one', async () => {
    const user = userEvent.setup();
    let failing = true;
    const api = mockDialogueApi({
      voiceAnswer: () =>
        failing
          ? errorResponse(503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE)
          : jsonResponse(PENDING_ANSWER, 201),
    });
    renderScreen();

    await recordAnswer(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.speechUnavailable,
    );
    expect(screen.getByLabelText(uk.dialogue.form.label)).toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.dialogue.voice.resend }),
    );

    expect(
      await screen.findByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const [first, second] = api.audioRequests();
    expect(api.audioRequests()).toHaveLength(2);
    await expect(second?.text()).resolves.toBe(await first?.text());
    expect(media.getUserMedia).toHaveBeenCalledOnce();
  });

  it.each([
    [413, ERROR_CODES.AUDIO_TOO_LARGE, uk.dialogue.errors.audioTooLarge],
    [415, ERROR_CODES.AUDIO_UNSUPPORTED, uk.dialogue.errors.audioUnsupported],
  ])(
    '[TC-04-08] a %i %s offers the text form and no resend',
    async (status, code, message) => {
      const user = userEvent.setup();
      mockDialogueApi({ voiceAnswer: () => errorResponse(status, code) });
      renderScreen();

      await recordAnswer(user);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(
        screen.queryByRole('button', { name: uk.dialogue.voice.resend }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(uk.dialogue.form.label)).toBeInTheDocument();
    },
  );

  it('[TC-04-08] a failed analysis after a voice answer retries only the analysis', async () => {
    const user = userEvent.setup();
    let failing = true;
    const api = mockDialogueApi({
      voiceAnswer: () => jsonResponse(PENDING_ANSWER, 201),
      analyze: () =>
        failing
          ? errorResponse(503, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE)
          : analysisOk(),
    });
    renderScreen();

    await recordAnswer(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.errors.modelUnavailable,
    );
    expect(
      screen.queryByRole('button', { name: uk.dialogue.voice.resend }),
    ).not.toBeInTheDocument();

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
    expect(api.audioRequests()).toHaveLength(1);
  });

  it('[TC-04-05] a denied microphone shows the help and the text answer still works', async () => {
    const user = userEvent.setup();
    media.getUserMedia.mockRejectedValueOnce(
      new DOMException('x', 'NotAllowedError'),
    );
    const api = mockDialogueApi({
      answer: () => jsonResponse(PENDING_ANSWER, 201),
    });
    renderScreen();

    await user.click(
      screen.getByRole('button', { name: uk.dialogue.voice.record }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.voice.help.denied.title,
    );

    await user.type(
      screen.getByLabelText(uk.dialogue.form.label),
      'I very like',
    );
    await user.click(
      screen.getByRole('button', { name: uk.dialogue.form.submit }),
    );

    expect(
      await screen.findByRole('button', { name: 'go' }),
    ).toBeInTheDocument();
    expect(api.answerRequests()).toEqual([{ text: 'I very like' }]);
    expect(api.audioRequests()).toHaveLength(0);
  });
});
