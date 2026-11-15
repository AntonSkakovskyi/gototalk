import { Group, Stack, Text } from '@mantine/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wordsListQueryOptions } from '@/features/vocabulary/api/words-queries';
import { WordMarks } from '@/features/vocabulary/components/WordMarks/WordMarks';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { LoadMoreFooter } from '@/shared/ui/LoadMoreFooter/LoadMoreFooter';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import classes from './WordList.module.scss';

export function WordList() {
  const { t } = useTranslation();
  const words = useInfiniteQuery(wordsListQueryOptions());

  if (words.data === undefined) {
    return words.isError ? (
      <LoadError onRetry={() => void words.refetch()} />
    ) : (
      <SectionSkeleton />
    );
  }

  const items = words.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return <Text>{t('vocabulary.list.empty')}</Text>;
  }

  return (
    <Stack gap="md">
      <Stack component="ul" gap="lg" className={classes.list}>
        {items.map((word) => (
          <li key={word.id}>
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Text fw={500} lang={ENGLISH_LANG}>
                    {word.lemma}
                  </Text>
                  {word.translationUk && (
                    <Text size="sm" c="dimmed">
                      {word.translationUk}
                    </Text>
                  )}
                </div>
                <Text size="sm" c="dimmed">
                  {t(`vocabulary.list.state.${word.state}`)}
                </Text>
              </Group>
              <WordMarks word={word} />
            </Stack>
          </li>
        ))}
      </Stack>
      <LoadMoreFooter
        loadedText={t('vocabulary.list.loaded', { count: items.length })}
        loadMoreLabel={t('vocabulary.list.loadMore')}
        errorMessage={t('vocabulary.list.loadMoreError')}
        hasNextPage={words.hasNextPage}
        isFetchingNextPage={words.isFetchingNextPage}
        isFetchNextPageError={words.isFetchNextPageError}
        onLoadMore={() => void words.fetchNextPage()}
      />
    </Stack>
  );
}
