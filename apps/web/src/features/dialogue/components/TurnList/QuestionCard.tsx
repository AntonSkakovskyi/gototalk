import { Paper, Stack, Text } from '@mantine/core';
import { useId, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

const QUESTION_LANGUAGE = 'en';

interface QuestionCardProps {
  text: string;
  current: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function QuestionCard({ text, current, ref }: QuestionCardProps) {
  const { t } = useTranslation();
  const labelId = useId();

  if (!current) {
    return (
      <Paper withBorder p="md" radius="md">
        <Text lang={QUESTION_LANGUAGE}>{text}</Text>
      </Paper>
    );
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
        <Text size="xl" fw={500} lang={QUESTION_LANGUAGE}>
          {text}
        </Text>
      </Stack>
    </Paper>
  );
}
