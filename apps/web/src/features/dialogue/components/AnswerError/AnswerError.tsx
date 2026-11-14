import { Alert, Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { dialogueErrorKey } from '@/features/dialogue/lib/dialogue-errors';

interface AnswerErrorProps {
  error: unknown;
  onRetry?: () => void;
  /** Overrides the generic «try again» label, e.g. for resending a recording. */
  retryLabel?: string;
}

export function AnswerError({ error, onRetry, retryLabel }: AnswerErrorProps) {
  const { t } = useTranslation();

  if (error === null || error === undefined) {
    return null;
  }

  return (
    <Stack gap="sm" align="flex-start">
      <Alert color="red" role="alert" w="100%">
        {t(dialogueErrorKey(error).key)}
      </Alert>
      {onRetry && (
        <Button variant="light" size="lg" onClick={onRetry}>
          {retryLabel ?? t('common.actions.retry')}
        </Button>
      )}
    </Stack>
  );
}
