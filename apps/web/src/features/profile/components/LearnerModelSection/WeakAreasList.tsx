import type { LearnerModel } from '@gototalk/shared';
import { Badge, Group, List, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ModelBlock } from './ModelBlock';

interface WeakAreasListProps {
  weakAreas: LearnerModel['weakAreas'];
}

export function WeakAreasList({ weakAreas }: WeakAreasListProps) {
  const { t } = useTranslation();

  return (
    <ModelBlock title={t('profile.learnerModel.weakAreas.title')}>
      {weakAreas.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('profile.learnerModel.weakAreas.empty')}
        </Text>
      ) : (
        <List type="ordered" spacing="xs">
          {weakAreas.map(({ category, frequency }) => (
            <List.Item key={category}>
              <Group component="span" gap="xs">
                <Text component="span">
                  {t(`mistakeCategories.${category}`)}
                </Text>
                <Badge variant="light" size="lg" tt="none">
                  {t('profile.learnerModel.weakAreas.times', {
                    count: frequency,
                  })}
                </Badge>
              </Group>
            </List.Item>
          ))}
        </List>
      )}
    </ModelBlock>
  );
}
