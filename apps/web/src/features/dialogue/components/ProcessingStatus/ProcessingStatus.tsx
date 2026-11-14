import { Group, Loader, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';

interface ProcessingStatusProps {
  phase: AnswerPhase;
}

export function ProcessingStatus({ phase }: ProcessingStatusProps) {
  const { t } = useTranslation();

  return (
    <div aria-live="polite">
      {phase !== 'idle' && (
        <Group gap="xs">
          <Loader size="sm" aria-hidden />
          <Text c="dimmed">{t(`dialogue.status.${phase}`)}</Text>
        </Group>
      )}
    </div>
  );
}
