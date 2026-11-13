import { WORD_STATES, type LearnerModel } from '@gototalk/shared';
import { Paper, SimpleGrid, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ModelBlock } from './ModelBlock';

interface VocabularyStatsProps {
  vocabulary: LearnerModel['vocabulary'];
}

export function VocabularyStats({ vocabulary }: VocabularyStatsProps) {
  const { t } = useTranslation();

  return (
    <ModelBlock title={t('profile.learnerModel.vocabulary.title')}>
      <SimpleGrid component="dl" cols={2} m={0}>
        {WORD_STATES.map((state) => (
          <Paper key={state} component="div" withBorder p="sm">
            <Text component="dt" size="sm" c="dimmed">
              {t(`profile.learnerModel.states.${state}`)}
            </Text>
            <Text component="dd" size="xl" fw={700} m={0}>
              {vocabulary[state]}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </ModelBlock>
  );
}
