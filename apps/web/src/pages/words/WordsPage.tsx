import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { WordList } from '@/features/vocabulary/components/WordList/WordList';

export function WordsPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <Title order={1}>{t('pages.words.title')}</Title>
      <WordList />
    </Stack>
  );
}
