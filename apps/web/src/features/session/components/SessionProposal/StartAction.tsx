import { Alert, Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { sessionErrorKey } from '@/features/session/lib/session-errors';
import classes from './StartAction.module.scss';

interface StartActionProps {
  error: Error | null;
  loading: boolean;
  disabled: boolean;
  onStart: () => void;
}

export function StartAction({
  error,
  loading,
  disabled,
  onStart,
}: StartActionProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="sm" className={classes.actions}>
      {error && (
        <Alert color="red" role="alert">
          {t(sessionErrorKey(error).key)}
        </Alert>
      )}
      <Button
        size="lg"
        fullWidth
        loading={loading}
        disabled={disabled}
        onClick={onStart}
      >
        {t('session.proposal.start')}
      </Button>
    </Stack>
  );
}
