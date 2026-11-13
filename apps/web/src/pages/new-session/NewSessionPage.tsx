import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SessionProposal } from '@/features/session/components/SessionProposal/SessionProposal';

export function NewSessionPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Title order={1}>{t('pages.newSession.title')}</Title>
      <SessionProposal />
    </Stack>
  );
}
