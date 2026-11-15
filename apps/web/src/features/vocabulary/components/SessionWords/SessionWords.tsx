import type { Word } from '@gototalk/shared';
import { List, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import { WordMarks } from '@/features/vocabulary/components/WordMarks/WordMarks';
import classes from './SessionWords.module.scss';

const NO_MARKERS = 'none';

interface SessionWordsProps {
  words: Word[];
}

export function SessionWords({ words }: SessionWordsProps) {
  const { t } = useTranslation();

  return (
    <Stack component="section" gap="sm">
      <Title order={2}>{t('vocabulary.session.title')}</Title>
      {words.length === 0 ? (
        <Text c="dimmed">{t('vocabulary.session.empty')}</Text>
      ) : (
        <List
          listStyleType={NO_MARKERS}
          spacing="md"
          withPadding={false}
          classNames={{
            itemWrapper: classes.itemWrapper,
            itemLabel: classes.itemLabel,
          }}
        >
          {words.map((word) => (
            <List.Item key={word.id}>
              <Stack gap="xs">
                <div>
                  <Text fw={500} lang={ENGLISH_LANG}>
                    {word.lemma}
                  </Text>
                  {word.translationUk && (
                    <Text size="sm" c="dimmed">
                      {word.translationUk}
                    </Text>
                  )}
                </div>
                <WordMarks word={word} />
              </Stack>
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  );
}
