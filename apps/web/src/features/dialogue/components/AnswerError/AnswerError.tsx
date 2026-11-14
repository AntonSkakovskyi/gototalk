import { Alert, Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { dialogueErrorKey } from '@/features/dialogue/lib/dialogue-errors';

interface AnswerErrorProps {
  error: unknown;
  onRetry?: () => void;
}

export function AnswerError({ error, onRetry }: AnswerErrorProps) {
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
          {t('common.actions.retry')}
        </Button>
      )}
    </Stack>
  );
}
