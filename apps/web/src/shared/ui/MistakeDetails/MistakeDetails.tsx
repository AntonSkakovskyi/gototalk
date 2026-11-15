import type { MistakeView } from '@gototalk/shared';
import { Badge, Button, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { markMistakeErrorKey } from '@/shared/api/mistake-errors';
import { useMarkMistake } from '@/shared/hooks/use-mark-mistake';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import { Correction } from './Correction';

interface MistakeDetailsProps {
  id: string;
  sessionId: string;
  mistake: MistakeView;
}

export function MistakeDetails({
  id,
  sessionId,
  mistake,
}: MistakeDetailsProps) {
  const { t } = useTranslation();
  const { mark, isPendingFor, error } = useMarkMistake(sessionId);

  return (
    <Paper
      id={id}
      component="section"
      aria-label={t('transcript.mistake.regionLabel')}
      withBorder
      p="md"
      radius="md"
    >
      <Stack gap="sm" align="flex-start">
        <Badge variant="light" size="lg" tt="none">
          {t(`mistakeCategories.${mistake.category}`)}
        </Badge>
        <Correction
          original={mistake.original}
          suggestion={mistake.suggestion}
        />
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {t('transcript.mistake.explanationLabel')}
          </Text>
          <Text lang={ENGLISH_LANG}>{mistake.explanationEn}</Text>
        </Stack>
        <Text size="sm" c="dimmed">
          {mistake.translationUk}
        </Text>
        <Button
          variant="light"
          size="lg"
          disabled={isPendingFor(mistake.id)}
          onClick={() => mark(mistake.id)}
        >
          {t('transcript.mistake.notMistake')}
        </Button>
        <div aria-live="polite">
          {error && (
            <Text size="sm" c="red">
              {t(markMistakeErrorKey(error).key)}
            </Text>
          )}
        </div>
      </Stack>
    </Paper>
  );
}
