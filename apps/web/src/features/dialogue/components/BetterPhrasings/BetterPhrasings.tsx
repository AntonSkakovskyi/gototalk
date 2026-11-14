import type { BetterPhrasing } from '@gototalk/shared';
import { List, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

const PHRASING_LANGUAGE = 'en';

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
      <Title order={4}>{t('dialogue.better.title')}</Title>
      <List spacing="xs" size="sm">
        {phrasings.map(({ original, better }) => (
          <List.Item key={`${original}|${better}`}>
            <Text span lang={PHRASING_LANGUAGE}>
              {original}
            </Text>
            {' → '}
            <Text span lang={PHRASING_LANGUAGE} fw={500}>
              {better}
            </Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
