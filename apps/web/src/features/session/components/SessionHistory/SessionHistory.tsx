import { Button, Stack, Text } from '@mantine/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { sessionHistoryQueryOptions } from '@/features/session/api/session-queries';
import { SessionListItem } from '@/features/session/components/SessionListItem/SessionListItem';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { LoadMoreFooter } from '@/shared/ui/LoadMoreFooter/LoadMoreFooter';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import classes from './SessionHistory.module.scss';

export function SessionHistory() {
  const { t } = useTranslation();
  const history = useInfiniteQuery(sessionHistoryQueryOptions());

  if (history.data === undefined) {
    return history.isError ? (
      <LoadError onRetry={() => void history.refetch()} />
    ) : (
      <SectionSkeleton />
    );
  }

  const sessions = history.data.pages.flatMap((page) => page.items);
  if (sessions.length === 0) {
    return (
      <Stack gap="md">
        <Text>{t('session.history.empty')}</Text>
        <Button component={Link} to="/sessions/new" size="lg" fullWidth>
          {t('session.history.startSession')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Stack component="ul" gap="sm" className={classes.list}>
        {sessions.map((session) => (
          <li key={session.id}>
            <SessionListItem session={session} />
          </li>
        ))}
      </Stack>
      <LoadMoreFooter
        loadedText={t('session.history.loaded', { count: sessions.length })}
        loadMoreLabel={t('session.history.loadMore')}
        errorMessage={t('session.history.loadMoreError')}
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        isFetchNextPageError={history.isFetchNextPageError}
        onLoadMore={() => void history.fetchNextPage()}
      />
    </Stack>
  );
}
