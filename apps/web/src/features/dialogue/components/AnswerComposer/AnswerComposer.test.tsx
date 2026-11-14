import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import { installFakeMedia } from '@/features/dialogue/testing/fake-media';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { AnswerComposer } from './AnswerComposer';

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  media = installFakeMedia();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

function renderComposer({
  phase = 'idle',
  audioFailed = false,
}: { phase?: AnswerPhase; audioFailed?: boolean } = {}) {
  const submitText = vi
    .fn<(text: string) => Promise<boolean>>()
    .mockResolvedValue(true);
  const submitAudio = vi
    .fn<(audio: Blob) => Promise<boolean>>()
    .mockResolvedValue(true);
  const view = renderWithProviders(
    <AnswerComposer
      phase={phase}
      submitText={submitText}
      submitAudio={submitAudio}
      audioFailed={audioFailed}
    />,
  );
  return { ...view, submitText, submitAudio };
}

const recordButton = () =>
  screen.getByRole('button', { name: uk.dialogue.voice.record });
const stopButton = () =>
  screen.getByRole('button', { name: uk.dialogue.voice.stop });
const writeButton = () =>
  screen.getByRole('button', { name: uk.dialogue.voice.writeInstead });
const textField = () => screen.queryByLabelText(uk.dialogue.form.label);
const recordingLabel = () =>
  screen.findByText(uk.dialogue.voice.indicator.recording);

function denyMicrophone() {
  media.getUserMedia.mockRejectedValueOnce(
    new DOMException('x', 'NotAllowedError'),
  );
}

describe('AnswerComposer', () => {
  it('[TC-04-05] puts recording first and keeps the text form behind a secondary action', () => {
    renderComposer();

    expect(recordButton()).toBeEnabled();
    expect(textField()).not.toBeInTheDocument();
    expect(writeButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-04-05] opens the text form with focus on request and drops the action', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(writeButton());

    expect(textField()).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: uk.dialogue.voice.writeInstead }),
    ).not.toBeInTheDocument();
    expect(recordButton()).toBeEnabled();
  });

  it('[TC-04-05] records, stops and hands over the recording', async () => {
    const user = userEvent.setup();
    const { submitAudio } = renderComposer();

    await user.click(recordButton());

    expect(await recordingLabel()).toBeVisible();
    expect(stopButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('timer')).toHaveTextContent('0:00 / 2:00');

    await user.click(stopButton());

    await waitFor(() => expect(submitAudio).toHaveBeenCalledOnce());
    const [audio] = submitAudio.mock.calls[0] ?? [];
    expect(audio).toBeInstanceOf(Blob);
    expect(audio?.type).toBe('audio/webm;codecs=opus');
    expect(recordButton()).toHaveAttribute('aria-pressed', 'false');
    expect(media.streams[0]?.tracks.every((track) => track.stopped)).toBe(true);
  });

  it('[TC-04-05] records and stops with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { submitAudio } = renderComposer();

    await user.tab();
    expect(recordButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    await recordingLabel();
    expect(stopButton()).toHaveFocus();
    await user.keyboard(' ');

    await waitFor(() => expect(submitAudio).toHaveBeenCalledOnce());
  });

  it('[TC-04-05] locks the text form while recording and unlocks it afterwards', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(writeButton());
    await user.type(screen.getByLabelText(uk.dialogue.form.label), 'draft');

    await user.click(recordButton());
    await recordingLabel();
    expect(textField()).toHaveAttribute('readonly');
    expect(
      screen.getByRole('button', { name: uk.dialogue.form.submit }),
    ).toBeDisabled();

    await user.click(stopButton());

    await waitFor(() => expect(textField()).not.toHaveAttribute('readonly'));
    expect(textField()).toHaveValue('draft');
  });

  it.each<AnswerPhase>(['sending', 'recognizing', 'analyzing'])(
    '[TC-04-12] disables recording and the text action while %s',
    (phase) => {
      renderComposer({ phase });

      expect(recordButton()).toBeDisabled();
      expect(writeButton()).toBeDisabled();
    },
  );

  it('[TC-04-05] shows the help and opens the text form without stealing focus when the permission is denied', async () => {
    const user = userEvent.setup();
    denyMicrophone();
    renderComposer();

    await user.click(recordButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.voice.help.denied.title,
    );
    expect(textField()).toBeInTheDocument();
    expect(textField()).not.toHaveFocus();
    expect(recordButton()).toBeEnabled();
  });

  it('[TC-04-05] keeps the typed text when recording works again after a denial', async () => {
    const user = userEvent.setup();
    denyMicrophone();
    renderComposer();
    await user.click(recordButton());
    await user.type(await screen.findByLabelText(uk.dialogue.form.label), 'hi');

    await user.click(recordButton());
    await recordingLabel();

    expect(textField()).toHaveValue('hi');
  });

  it('[TC-04-05] explains that recording is unsupported and offers the text form at once', () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    renderComposer();

    expect(screen.getByRole('status')).toHaveTextContent(
      uk.dialogue.voice.help.unsupported.title,
    );
    expect(textField()).toBeInTheDocument();
    expect(textField()).not.toHaveFocus();
    expect(recordButton()).toBeDisabled();
  });

  it('[TC-04-05] says HTTPS is needed on an insecure page', () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.stubGlobal('isSecureContext', false);
    renderComposer();

    expect(screen.getByRole('status')).toHaveTextContent('HTTPS');
    expect(textField()).toBeInTheDocument();
  });

  it('[TC-04-08] opens the text form after a failed voice answer', () => {
    renderComposer({ audioFailed: true });

    expect(textField()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(recordButton()).toBeEnabled();
  });

  it('[TC-04-05] stops the microphone when the composer unmounts mid-recording', async () => {
    const user = userEvent.setup();
    const { unmount, submitAudio } = renderComposer();
    await user.click(recordButton());
    await recordingLabel();
    expect(media.streams[0]?.tracks.some((track) => track.stopped)).toBe(false);

    unmount();

    expect(media.streams[0]?.tracks.every((track) => track.stopped)).toBe(true);
    expect(submitAudio).not.toHaveBeenCalled();
  });
});
