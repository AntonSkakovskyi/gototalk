import { Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { sessionListQueryOptions } from '@/features/session/api/session-queries';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import classes from './RecentSessions.module.scss';
import { SessionListItem } from './SessionListItem';

export function RecentSessions() {
  const { t } = useTranslation();
  const titleId = useId();
  const sessions = useQuery(sessionListQueryOptions());

  return (
    <Stack gap="md" component="section" aria-labelledby={titleId}>
      <Title order={2} size="h3" id={titleId}>
        {t('session.home.recent.title')}
      </Title>
      {sessions.isPending && <SectionSkeleton />}
      {sessions.isError && (
        <LoadError onRetry={() => void sessions.refetch()} />
      )}
      {sessions.data?.length === 0 && (
        <Text>{t('session.home.recent.empty')}</Text>
      )}
      {sessions.data && sessions.data.length > 0 && (
        <Stack component="ul" gap="sm" className={classes.list}>
          {sessions.data.map((session) => (
            <li key={session.id}>
              <SessionListItem session={session} />
            </li>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
