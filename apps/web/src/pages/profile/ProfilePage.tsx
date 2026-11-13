import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AccountSection } from '@/features/auth/components/AccountSection/AccountSection';
import { GoalsSection } from '@/features/profile/components/GoalsSection/GoalsSection';
import { ProfileDetails } from '@/features/profile/components/ProfileDetails/ProfileDetails';

export function ProfilePage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Title order={1}>{t('pages.profile.title')}</Title>
      <ProfileDetails />
      <GoalsSection />
      <AccountSection />
    </Stack>
  );
}
