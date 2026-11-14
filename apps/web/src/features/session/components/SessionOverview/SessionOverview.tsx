import type { SessionDetails } from '@gototalk/shared';
import { Stack, Title } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isSessionNotFound } from '@/features/session/lib/session-errors';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import { FocusedTitle } from './FocusedTitle';
import { SessionSummary } from './SessionSummary';

interface SessionOverviewProps {
  details: UseQueryResult<SessionDetails>;
}

export function SessionOverview({ details }: SessionOverviewProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      {details.isPending && (
        <>
          <Title order={1}>{t('session.details.pageTitle')}</Title>
          <SectionSkeleton />
        </>
      )}
      {details.isError && isSessionNotFound(details.error) && (
        <FocusedTitle>{t('session.errors.notFound')}</FocusedTitle>
      )}
      {details.isError && !isSessionNotFound(details.error) && (
        <>
          <Title order={1}>{t('session.details.pageTitle')}</Title>
          <LoadError onRetry={() => void details.refetch()} />
        </>
      )}
      {details.data && <SessionSummary session={details.data} />}
    </Stack>
  );
}
