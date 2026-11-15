import type { Utterance } from '@gototalk/shared';
import { Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AnswerTranscript } from '@/shared/ui/AnswerTranscript/AnswerTranscript';

const ANSWER_BACKGROUND = 'var(--mantine-color-default-hover)';

interface AnswerCardProps {
  sessionId: string;
  utterance: Utterance;
  showFeedback: boolean;
}

export function AnswerCard({
  sessionId,
  utterance,
  showFeedback,
}: AnswerCardProps) {
  const { t } = useTranslation();

  return (
    <Paper p="md" radius="md" bg={ANSWER_BACKGROUND}>
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {t('transcript.you')}
        </Text>
        <AnswerTranscript
          sessionId={sessionId}
          utterance={utterance}
          showFeedback={showFeedback}
        />
      </Stack>
    </Paper>
  );
}
