import { configure, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import userEvent from '@testing-library/user-event';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import { installFakeMedia } from '@/features/dialogue/recording/testing/fake-media';
import { uk } from '@/shared/i18n/resources';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { useComposerState } from '@/features/dialogue/hooks/use-composer-state';
import { AnswerComposer } from './AnswerComposer';

const SLOW_MS = 5000;

// Recording state arrives through async media events, which lag under CPU load.
configure({ asyncUtilTimeout: SLOW_MS });
vi.setConfig({ testTimeout: SLOW_MS * 3 });

let media: ReturnType<typeof installFakeMedia>;

beforeEach(() => {
  media = installFakeMedia();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

interface HarnessProps {
  phase: AnswerPhase;
  audioFailed: boolean;
  submitText: (text: string) => Promise<boolean>;
  submitAudio: (audio: Blob) => Promise<boolean>;
  onRecordingChange?: (recording: boolean) => void;
}

// Mirrors the screen: the composer state lives above it, and the composer can be remounted.
function Harness({ onRecordingChange, ...props }: HarnessProps) {
  const composer = useComposerState();
  const [turn, setTurn] = useState(0);
  useEffect(
    () => onRecordingChange?.(composer.recording),
    [composer.recording, onRecordingChange],
  );
  return (
    <>
      <AnswerComposer key={turn} composer={composer} {...props} />
      <button type="button" onClick={() => setTurn((current) => current + 1)}>
        next turn
      </button>
    </>
  );
}

function renderComposer({
  phase = 'idle',
  audioFailed = false,
  onRecordingChange,
}: {
  phase?: AnswerPhase;
  audioFailed?: boolean;
  onRecordingChange?: (recording: boolean) => void;
} = {}) {
  const submitText = vi
    .fn<(text: string) => Promise<boolean>>()
    .mockResolvedValue(true);
  const submitAudio = vi
    .fn<(audio: Blob) => Promise<boolean>>()
    .mockResolvedValue(true);
  const view = renderWithProviders(
    <Harness
      phase={phase}
      submitText={submitText}
      submitAudio={submitAudio}
      audioFailed={audioFailed}
      onRecordingChange={onRecordingChange}
    />,
  );
  return { ...view, submitText, submitAudio };
}

const recordButton = () =>
  screen.getByRole('button', { name: uk.dialogue.voice.record });
const stopButton = () =>
  screen.getByRole('button', {
    name: uk.dialogue.voice.record,
    pressed: true,
  });
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
    expect(screen.getByRole('timer')).toHaveTextContent(/0:\d\d \/ 2:00/);

    await user.click(stopButton());

    await waitFor(() => expect(submitAudio).toHaveBeenCalledOnce());
    const [audio] = submitAudio.mock.calls[0] ?? [];
    expect(audio).toBeInstanceOf(Blob);
    expect(audio?.type).toBe('audio/webm;codecs=opus');
    await waitFor(() =>
      expect(recordButton()).toHaveAttribute('aria-pressed', 'false'),
    );
    await waitFor(() =>
      expect(media.streams[0]?.tracks.every((track) => track.stopped)).toBe(
        true,
      ),
    );
  });

  it('[TC-04-05] records and stops with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { submitAudio } = renderComposer();

    await user.tab();
    await waitFor(() => expect(recordButton()).toHaveFocus());
    await user.keyboard('{Enter}');
    await recordingLabel();
    await waitFor(() => expect(stopButton()).toHaveFocus());
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
    await waitFor(() => expect(textField()).toHaveAttribute('readonly'));
    expect(
      screen.getByRole('button', { name: uk.dialogue.form.submit }),
    ).toBeDisabled();

    await user.click(stopButton());

    await waitFor(() => expect(textField()).not.toHaveAttribute('readonly'));
    await waitFor(() => expect(textField()).toHaveValue('draft'));
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
    expect(
      await screen.findByLabelText(uk.dialogue.form.label),
    ).toBeInTheDocument();
    expect(textField()).not.toHaveFocus();
    await waitFor(() => expect(recordButton()).toBeEnabled());
  });

  it('[TC-04-05] keeps the typed text when recording works again after a denial', async () => {
    const user = userEvent.setup();
    denyMicrophone();
    renderComposer();
    await user.click(recordButton());
    await user.type(await screen.findByLabelText(uk.dialogue.form.label), 'hi');

    await user.click(recordButton());
    await recordingLabel();

    await waitFor(() => expect(textField()).toHaveValue('hi'));
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

  it('[TC-04-05] keeps the text form open on the next turn once it was requested', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(writeButton());

    await user.click(screen.getByRole('button', { name: 'next turn' }));

    expect(
      await screen.findByLabelText(uk.dialogue.form.label),
    ).toBeInTheDocument();
    expect(textField()).not.toHaveFocus();
  });

  it('[TC-04-08] keeps the text form open on the next turn after the microphone was denied', async () => {
    const user = userEvent.setup();
    denyMicrophone();
    renderComposer();
    await user.click(recordButton());
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'next turn' }));

    expect(
      await screen.findByLabelText(uk.dialogue.form.label),
    ).toBeInTheDocument();
    expect(recordButton()).toBeEnabled();
  });

  it('[TC-04-05] starts with the text form closed when nothing opened it', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: 'next turn' }));

    expect(textField()).not.toBeInTheDocument();
    expect(writeButton()).toBeEnabled();
  });

  it('[TC-04-14] reports the recording to the screen and clears it on stop', async () => {
    const user = userEvent.setup();
    const onRecordingChange = vi.fn<(recording: boolean) => void>();
    renderComposer({ onRecordingChange });

    await user.click(recordButton());
    await recordingLabel();
    await waitFor(() =>
      expect(onRecordingChange).toHaveBeenLastCalledWith(true),
    );

    await user.click(stopButton());
    await waitFor(() =>
      expect(onRecordingChange).toHaveBeenLastCalledWith(false),
    );
  });

  it('[TC-04-12] keeps recording disabled from the stop until the upload settles', async () => {
    const user = userEvent.setup();
    let finishUpload: (accepted: boolean) => void = () => undefined;
    const { submitAudio } = renderComposer();
    submitAudio.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishUpload = resolve;
      }),
    );

    await user.click(recordButton());
    await recordingLabel();
    await user.click(stopButton());

    await waitFor(() => expect(submitAudio).toHaveBeenCalledOnce());
    await waitFor(() => expect(recordButton()).toBeDisabled());
    expect(writeButton()).toBeDisabled();

    finishUpload(true);
    await waitFor(() => expect(recordButton()).toBeEnabled());
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
