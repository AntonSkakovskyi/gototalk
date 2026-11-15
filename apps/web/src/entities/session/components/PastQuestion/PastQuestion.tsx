import { Paper, Text } from '@mantine/core';
import { ENGLISH_LANG } from '@/shared/i18n/languages';

interface PastQuestionProps {
  text: string;
}

export function PastQuestion({ text }: PastQuestionProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text lang={ENGLISH_LANG}>{text}</Text>
    </Paper>
  );
}
