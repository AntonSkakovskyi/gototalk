import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SessionHistory } from '@/features/session/components/SessionHistory/SessionHistory';

export function HistoryPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <Title order={1}>{t('pages.history.title')}</Title>
      <SessionHistory />
    </Stack>
  );
}
