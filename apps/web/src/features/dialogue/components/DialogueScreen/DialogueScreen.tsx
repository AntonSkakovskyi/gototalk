import type { SessionDetails } from '@gototalk/shared';
import { Button, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AnswerComposer } from '@/features/dialogue/components/AnswerComposer/AnswerComposer';
import { AnswerError } from '@/features/dialogue/components/AnswerError/AnswerError';
import { FinishAction } from '@/features/dialogue/components/FinishAction/FinishAction';
import { HintPanel } from '@/features/dialogue/components/HintPanel/HintPanel';
import { ProcessingStatus } from '@/features/dialogue/components/ProcessingStatus/ProcessingStatus';
import { TurnList } from '@/features/dialogue/components/TurnList/TurnList';
import { useAnswerFlow } from '@/features/dialogue/hooks/use-answer-flow';
import { awaitingReply } from '@/features/dialogue/lib/turns';
import { reportPath } from '@/shared/router/session-paths';

interface DialogueScreenProps {
  details: SessionDetails;
}

export function DialogueScreen({ details }: DialogueScreenProps) {
  const { t } = useTranslation();
  const flow = useAnswerFlow(details.id);

  const finished = details.status === 'finished';
  const canAnswer = !awaitingReply(details.utterances);

  return (
    <Stack gap="lg">
      <TurnList details={details} />
      {!finished && (
        <>
          <ProcessingStatus phase={flow.phase} />
          <AnswerError
            error={flow.submitError}
            onRetry={
              flow.canRetrySend ? () => void flow.retrySend() : undefined
            }
            retryLabel={t('dialogue.voice.resend')}
          />
          <AnswerError
            error={flow.analysisError}
            onRetry={flow.canRetryAnalysis ? flow.retryAnalysis : undefined}
          />
          {details.planRemaining === 0 && (
            <Text c="dimmed">{t('dialogue.planExhausted')}</Text>
          )}
          {canAnswer && (
            <AnswerComposer
              phase={flow.phase}
              submitText={flow.submit}
              submitAudio={flow.submitAudio}
              audioFailed={flow.audioFailed}
            />
          )}
          {canAnswer && flow.phase === 'idle' && (
            <HintPanel sessionId={details.id} />
          )}
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
