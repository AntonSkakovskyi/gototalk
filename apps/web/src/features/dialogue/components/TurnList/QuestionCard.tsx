import { Paper, Stack, Text } from '@mantine/core';
import { useId, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import { PastQuestion } from '@/shared/ui/PastQuestion/PastQuestion';

interface QuestionCardProps {
  text: string;
  current: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function QuestionCard({ text, current, ref }: QuestionCardProps) {
  const { t } = useTranslation();
  const labelId = useId();

  if (!current) {
    return <PastQuestion text={text} />;
  }

  return (
    <Paper
      ref={ref}
      component="section"
      aria-labelledby={labelId}
      tabIndex={-1}
      withBorder
      p="lg"
      radius="md"
    >
      <Stack gap="xs">
        <Text id={labelId} size="sm" c="dimmed">
          {t('dialogue.turns.currentQuestion')}
        </Text>
        <Text size="xl" fw={500} lang={ENGLISH_LANG}>
          {text}
        </Text>
      </Stack>
    </Paper>
  );
}
