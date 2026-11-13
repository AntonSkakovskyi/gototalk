import { Paper, Stack, Text } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

const QUESTION_LANGUAGE = 'en';

interface CurrentQuestionProps {
  question: string;
}

export function CurrentQuestion({ question }: CurrentQuestionProps) {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <Stack gap="sm">
      <Paper
        component="section"
        aria-labelledby={labelId}
        withBorder
        p="lg"
        radius="md"
      >
        <Stack gap="xs">
          <Text id={labelId} size="sm" c="dimmed">
            {t('session.details.questionLabel')}
          </Text>
          <Text size="xl" fw={500} lang={QUESTION_LANGUAGE}>
            {question}
          </Text>
        </Stack>
      </Paper>
      <Text size="sm" c="dimmed">
        {t('session.details.answerSoon')}
      </Text>
    </Stack>
  );
}
