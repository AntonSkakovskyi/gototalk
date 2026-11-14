import { Button, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MicPermissionHelp } from '@/features/dialogue/components/MicPermissionHelp/MicPermissionHelp';
import { RecordButton } from '@/features/dialogue/components/RecordButton/RecordButton';
import { RecordingIndicator } from '@/features/dialogue/components/RecordingIndicator/RecordingIndicator';
import { TextAnswerForm } from '@/features/dialogue/components/TextAnswerForm/TextAnswerForm';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import { useAudioRecorder } from '@/features/dialogue/hooks/use-audio-recorder';
import type { ComposerState } from '@/features/dialogue/hooks/use-composer-state';
import { voiceUnavailable } from '@/features/dialogue/lib/mic-help';

interface AnswerComposerProps {
  phase: AnswerPhase;
  composer: ComposerState;
  submitText: (text: string) => Promise<boolean>;
  submitAudio: (audio: Blob) => Promise<boolean>;
  /** The last voice answer failed, so the text form must be within reach. */
  audioFailed: boolean;
}

export function AnswerComposer({
  phase,
  composer,
  submitText,
  submitAudio,
  audioFailed,
}: AnswerComposerProps) {
  const { t } = useTranslation();
  const { textForm, setTextForm, setRecording } = composer;
  // Focus moves to the field only when the user opens it, not on a later remount.
  const [openedBeforeMount] = useState(textForm !== 'closed');
  // Bridges the gap between the recorder going idle and the upload starting.
  const [submitting, setSubmitting] = useState(false);
  const recorder = useAudioRecorder({
    onRecorded: (audio) => {
      setSubmitting(true);
      void submitAudio(audio).finally(() => setSubmitting(false));
    },
  });

  const recording = recorder.status === 'recording';
  const needsTextForm = voiceUnavailable(recorder.status) || audioFailed;

  // Once opened the form stays, so typed text survives the recorder recovering.
  useEffect(() => {
    if (textForm === 'closed' && needsTextForm) {
      setTextForm('automatic');
    }
  }, [textForm, needsTextForm, setTextForm]);

  useEffect(() => {
    setRecording(recording);
    return () => setRecording(false);
  }, [recording, setRecording]);

  const requestTextForm = () => setTextForm('requested');
  const busy = phase !== 'idle' || submitting;
  const cannotStart =
    busy ||
    recorder.status === 'unsupported' ||
    recorder.status === 'requesting';

  return (
    <Stack gap="md">
      <RecordButton
        recording={recording}
        disabled={cannotStart && !recording}
        onStart={() => void recorder.start()}
        onStop={recorder.stop}
      />
      <RecordingIndicator
        status={recorder.status}
        elapsedSeconds={recorder.elapsedSeconds}
        level={recorder.level}
      />
      <MicPermissionHelp
        status={recorder.status}
        errorName={recorder.errorName}
        insecureContext={recorder.insecureContext}
      />
      {textForm === 'closed' && !needsTextForm ? (
        <Button
          variant="subtle"
          size="lg"
          disabled={busy || recording}
          onClick={requestTextForm}
        >
          {t('dialogue.voice.writeInstead')}
        </Button>
      ) : (
        <TextAnswerForm
          phase={phase}
          submit={submitText}
          disabled={recording || submitting}
          autoFocus={textForm === 'requested' && !openedBeforeMount}
        />
      )}
    </Stack>
  );
}
