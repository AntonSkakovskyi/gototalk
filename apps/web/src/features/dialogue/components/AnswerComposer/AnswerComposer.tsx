import { Button, Stack } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MicPermissionHelp } from '@/features/dialogue/components/MicPermissionHelp/MicPermissionHelp';
import { RecordButton } from '@/features/dialogue/components/RecordButton/RecordButton';
import { RecordingIndicator } from '@/features/dialogue/components/RecordingIndicator/RecordingIndicator';
import { TextAnswerForm } from '@/features/dialogue/components/TextAnswerForm/TextAnswerForm';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import { useAudioRecorder } from '@/features/dialogue/hooks/use-audio-recorder';
import { voiceUnavailable } from '@/features/dialogue/lib/mic-help';

type TextForm = 'closed' | 'requested' | 'automatic';

interface AnswerComposerProps {
  phase: AnswerPhase;
  submitText: (text: string) => Promise<boolean>;
  submitAudio: (audio: Blob) => Promise<boolean>;
  /** The last voice answer failed, so the text form must be within reach. */
  audioFailed: boolean;
}

export function AnswerComposer({
  phase,
  submitText,
  submitAudio,
  audioFailed,
}: AnswerComposerProps) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder({
    onRecorded: (audio) => void submitAudio(audio),
  });
  const [textForm, setTextForm] = useState<TextForm>('closed');

  // Once opened the form stays, so typed text survives the recorder recovering.
  if (
    textForm === 'closed' &&
    (voiceUnavailable(recorder.status) || audioFailed)
  ) {
    setTextForm('automatic');
  }

  const requestTextForm = () => setTextForm('requested');
  const recording = recorder.status === 'recording';
  const busy = phase !== 'idle';
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
      {textForm === 'closed' ? (
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
          disabled={recording}
          autoFocus={textForm === 'requested'}
        />
      )}
    </Stack>
  );
}
