import type { BetterPhrasing } from '@gototalk/shared';
import { List, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ReplaceArrow } from '@/shared/ui/ReplaceArrow/ReplaceArrow';
import { ENGLISH_LANG } from '@/shared/i18n/languages';

interface BetterPhrasingsProps {
  phrasings: BetterPhrasing[];
}

export function BetterPhrasings({ phrasings }: BetterPhrasingsProps) {
  const { t } = useTranslation();

  if (phrasings.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Title order={3} size="h4">
        {t('transcript.better.title')}
      </Title>
      <List spacing="xs" size="sm">
        {phrasings.map(({ original, better }) => (
          <List.Item key={`${original}|${better}`}>
            <Text span lang={ENGLISH_LANG}>
              {original}
            </Text>
            <ReplaceArrow />
            <Text span lang={ENGLISH_LANG} fw={500}>
              {better}
            </Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
