import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import classes from './GateScreens.module.scss';

export function GateLoader() {
  const { t } = useTranslation();

  return (
    <Center
      className={classes.screen}
      role="status"
      aria-label={t('app.gate.loading')}
    >
      <Loader />
    </Center>
  );
}

export function GateError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <Center className={classes.screen} p="md">
      <Stack gap="md" align="center">
        <Alert color="red" role="alert">
          {t('app.gate.error')}
        </Alert>
        <Button size="lg" onClick={onRetry}>
          {t('app.gate.retry')}
        </Button>
      </Stack>
    </Center>
  );
}
