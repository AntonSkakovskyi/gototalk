import { Button, Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RecentSessions } from '@/features/session/components/RecentSessions/RecentSessions';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Title order={1}>{t('pages.session.title')}</Title>
      <Button component={Link} to="/sessions/new" size="lg" fullWidth>
        {t('session.home.start')}
      </Button>
      <RecentSessions />
    </Stack>
  );
}
