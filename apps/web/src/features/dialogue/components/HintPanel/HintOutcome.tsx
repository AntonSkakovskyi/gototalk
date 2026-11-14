import type { HintResult } from '@gototalk/shared';
import { Alert, Button, Loader, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  isTransientError,
  hintErrorKey,
} from '@/features/dialogue/lib/dialogue-errors';
import { ENGLISH_LANG } from '@/shared/i18n/languages';

interface HintOutcomeProps {
  /** The word the translation was requested for. */
  requestedWord: string | undefined;
  result: HintResult | undefined;
  error: unknown;
  isPending: boolean;
  onRetry: () => void;
}

export function HintOutcome({
  requestedWord,
  result,
  error,
  isPending,
  onRetry,
}: HintOutcomeProps) {
  const { t } = useTranslation();

  return (
    <div aria-live="polite" aria-atomic="true">
      {isPending && (
        <Stack gap="xs" align="center">
          <Loader size="sm" />
          <Text>{t('dialogue.hint.loading')}</Text>
        </Stack>
      )}
      {result?.kind === 'phrase_start' && (
        <Stack gap={0}>
          <Text c="dimmed">{t('dialogue.hint.result.phraseStart')}</Text>
          <Text size="lg" fw={500} lang={ENGLISH_LANG}>
            {result.text}
          </Text>
        </Stack>
      )}
      {result?.kind === 'translation' && (
        <Text size="lg" fw={500}>
          {result.word === null
            ? t('dialogue.hint.result.unknown')
            : t('dialogue.hint.result.translation', {
                word: requestedWord,
                translation: result.word,
              })}
        </Text>
      )}
      {error !== null && error !== undefined && (
        <Stack gap="sm" align="flex-start">
          <Alert color="red" w="100%">
            {t(hintErrorKey(error).key)}
          </Alert>
          {isTransientError(error) && (
            <Button variant="light" size="lg" onClick={onRetry}>
              {t('common.actions.retry')}
            </Button>
          )}
        </Stack>
      )}
    </div>
  );
}
