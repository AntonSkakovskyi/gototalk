import type { SessionDetails } from '@gototalk/shared';
import { Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AnswerError } from '@/features/dialogue/components/AnswerError/AnswerError';
import { ProcessingStatus } from '@/features/dialogue/components/ProcessingStatus/ProcessingStatus';
import { TextAnswerForm } from '@/features/dialogue/components/TextAnswerForm/TextAnswerForm';
import { TurnList } from '@/features/dialogue/components/TurnList/TurnList';
import { useAnswerFlow } from '@/features/dialogue/hooks/use-answer-flow';

interface DialogueScreenProps {
  details: SessionDetails;
}

export function DialogueScreen({ details }: DialogueScreenProps) {
  const { t } = useTranslation();
  const flow = useAnswerFlow(details.id);

  if (details.status === 'finished') {
    return <TurnList details={details} />;
  }

  return (
    <Stack gap="lg">
      <TurnList details={details} />
      <ProcessingStatus phase={flow.phase} />
      <AnswerError error={flow.submitError} />
      <AnswerError
        error={flow.analysisError}
        onRetry={flow.canRetryAnalysis ? flow.retryAnalysis : undefined}
      />
      {details.planRemaining === 0 && (
        <Text c="dimmed">{t('dialogue.planExhausted')}</Text>
      )}
      <TextAnswerForm phase={flow.phase} submit={flow.submit} />
    </Stack>
  );
}
