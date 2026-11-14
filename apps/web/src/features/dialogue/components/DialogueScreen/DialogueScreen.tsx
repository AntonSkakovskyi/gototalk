import type { SessionDetails } from '@gototalk/shared';
import { Button, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AnswerError } from '@/features/dialogue/components/AnswerError/AnswerError';
import { FinishAction } from '@/features/dialogue/components/FinishAction/FinishAction';
import { ProcessingStatus } from '@/features/dialogue/components/ProcessingStatus/ProcessingStatus';
import { TextAnswerForm } from '@/features/dialogue/components/TextAnswerForm/TextAnswerForm';
import { TurnList } from '@/features/dialogue/components/TurnList/TurnList';
import { useAnswerFlow } from '@/features/dialogue/hooks/use-answer-flow';
import { reportPath } from '@/features/dialogue/lib/report-path';

interface DialogueScreenProps {
  details: SessionDetails;
}

export function DialogueScreen({ details }: DialogueScreenProps) {
  const { t } = useTranslation();
  const flow = useAnswerFlow(details.id);

  const finished = details.status === 'finished';

  return (
    <Stack gap="lg">
      <TurnList details={details} />
      {!finished && (
        <>
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
        </>
      )}
      <FinishAction details={details} disabled={flow.phase !== 'idle'} />
      {finished && (
        <Button component={Link} to={reportPath(details.id)} size="lg">
          {t('dialogue.finish.toReport')}
        </Button>
      )}
    </Stack>
  );
}
