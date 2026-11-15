import { Alert, Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface LoadErrorProps {
  onRetry: () => void;
  message?: string;
}

export function LoadError({ onRetry, message }: LoadErrorProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="sm" align="flex-start">
      <Alert color="red" role="alert" w="100%">
        {message ?? t('errors.generic')}
      </Alert>
      <Button variant="light" size="lg" onClick={onRetry}>
        {t('common.actions.retry')}
      </Button>
    </Stack>
  );
}
