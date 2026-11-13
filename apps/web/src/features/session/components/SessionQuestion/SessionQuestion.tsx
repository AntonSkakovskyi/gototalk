import { Button, Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSessionDetails } from '@/features/session/hooks/use-session-details';
import { currentQuestion } from '@/features/session/lib/current-question';
import { isSessionNotFound } from '@/features/session/lib/session-errors';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import { CurrentQuestion } from './CurrentQuestion';
import { SessionSummary } from './SessionSummary';

interface SessionQuestionProps {
  sessionId: string;
}

export function SessionQuestion({ sessionId }: SessionQuestionProps) {
  const { t } = useTranslation();
  const details = useSessionDetails(sessionId);
  const question = details.data && currentQuestion(details.data.utterances);

  return (
    <Stack gap="lg">
      {details.isPending && <SectionSkeleton />}
      {details.isError && isSessionNotFound(details.error) && (
        <Title order={1}>{t('session.errors.notFound')}</Title>
      )}
      {details.isError && !isSessionNotFound(details.error) && (
        <LoadError onRetry={() => void details.refetch()} />
      )}
      {details.data && <SessionSummary session={details.data} />}
      {question && <CurrentQuestion question={question} />}
      <Button component={Link} to="/" variant="subtle" size="lg">
        {t('common.actions.home')}
      </Button>
    </Stack>
  );
}
