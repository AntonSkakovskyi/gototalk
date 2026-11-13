import { Center, Loader } from '@mantine/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './AuthBootstrap.module.scss';
import { GateError } from '@/app/router/guards/GateScreens/GateScreens';
import { refreshSession } from '@/shared/api/refresh';
import { getSession, useSession } from '@/shared/session/session-store';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status } = useSession();
  const [failed, setFailed] = useState(false);

  const restore = useCallback(() => {
    setFailed(false);
    refreshSession().catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (getSession().status === 'unknown') {
      restore();
    }
  }, [restore]);

  if (status !== 'unknown') {
    return children;
  }
  if (failed) {
    return <GateError onRetry={restore} />;
  }
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
