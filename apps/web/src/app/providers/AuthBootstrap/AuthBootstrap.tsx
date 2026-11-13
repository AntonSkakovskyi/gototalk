import { Center, Loader } from '@mantine/core';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './AuthBootstrap.module.scss';
import { refreshSession } from '@/shared/api/refresh';
import {
  clearSession,
  getSession,
  useSession,
} from '@/shared/session/session-store';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status } = useSession();

  useEffect(() => {
    if (getSession().status !== 'unknown') {
      return;
    }
    // Server or network errors must not leave the app on the loader forever.
    refreshSession().catch(() => clearSession());
  }, []);

  if (status === 'unknown') {
    return (
      <Center
        className={classes.root}
        role="status"
        aria-label={t('auth.loading')}
      >
        <Loader />
      </Center>
    );
  }

  return children;
}
