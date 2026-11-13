import { AppShell, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import classes from './AppLayout.module.scss';
import { BottomNav } from '@/app/layout/BottomNav/BottomNav';

// Footer height plus the bottom safe-area inset of notched phones.
const FOOTER_HEIGHT = 'calc(56px + env(safe-area-inset-bottom, 0px))';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <AppShell header={{ height: 48 }} footer={{ height: FOOTER_HEIGHT }}>
      <AppShell.Header className={classes.header}>
        <Text fw={700} size="lg">
          {t('app.title')}
        </Text>
      </AppShell.Header>
      <AppShell.Main>
        <div className={classes.content}>
          <Outlet />
        </div>
      </AppShell.Main>
      <AppShell.Footer>
        <BottomNav />
      </AppShell.Footer>
    </AppShell>
  );
}
