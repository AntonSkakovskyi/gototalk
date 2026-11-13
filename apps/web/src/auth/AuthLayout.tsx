import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './AuthLayout.module.scss';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className={classes.root}>
      <Stack className={classes.card} gap="lg">
        <Stack gap={4}>
          <Text fw={700} c="dimmed">
            {t('app.title')}
          </Text>
          <Title order={1}>{title}</Title>
        </Stack>
        {children}
      </Stack>
    </div>
  );
}
