import { MAX_RECORDING_SECONDS } from '@gototalk/shared';
import { Group, Progress, Text, VisuallyHidden } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { RecorderStatus } from '@/features/dialogue/hooks/use-audio-recorder';
import { formatElapsed } from '@/features/dialogue/lib/format-elapsed';

// Speech sits well below full scale, so the raw RMS is amplified for display.
const LEVEL_GAIN = 300;
const FULL_SCALE = 100;
const TIMER_FONT = 'monospace';
const METER_WIDTH = '10rem';

interface RecordingIndicatorProps {
  status: RecorderStatus;
  elapsedSeconds: number;
  level: number;
}

export function RecordingIndicator({
  status,
  elapsedSeconds,
  level,
}: RecordingIndicatorProps) {
  const { t } = useTranslation();
  const recording = status === 'recording';

  return (
    <div>
      <div aria-live="polite">
        {(recording || status === 'requesting') && (
          <Text fw={500}>{t(`dialogue.voice.indicator.${status}`)}</Text>
        )}
      </div>
      {recording && (
        <Group gap="md" wrap="nowrap">
          <Text role="timer" ff={TIMER_FONT}>
            <VisuallyHidden>
              {t('dialogue.voice.indicator.timerLabel')}{' '}
            </VisuallyHidden>
            {t('dialogue.voice.indicator.elapsed', {
              elapsed: formatElapsed(elapsedSeconds),
              max: formatElapsed(MAX_RECORDING_SECONDS),
            })}
          </Text>
          <div aria-hidden="true">
            <Progress
              value={Math.min(FULL_SCALE, level * LEVEL_GAIN)}
              w={METER_WIDTH}
              size="lg"
              color="red"
            />
          </div>
        </Group>
      )}
    </div>
  );
}
