import { Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface RecordButtonProps {
  recording: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({
  recording,
  disabled,
  onStart,
  onStop,
}: RecordButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      size="xl"
      fullWidth
      color={recording ? 'red' : undefined}
      aria-pressed={recording}
      disabled={disabled}
      onClick={recording ? onStop : onStart}
    >
      {t('dialogue.voice.record')}
    </Button>
  );
}
