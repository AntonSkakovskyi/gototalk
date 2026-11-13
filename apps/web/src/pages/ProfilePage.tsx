import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AccountSection } from '../auth/AccountSection.js';

export function ProfilePage() {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Title order={1}>{t('pages.profile.title')}</Title>
      <AccountSection />
    </Stack>
  );
}
