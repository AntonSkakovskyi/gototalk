import { WORD_STATES, type LearnerModel } from '@gototalk/shared';
import { Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { learnerModelQueryOptions } from '@/features/profile/api/profile-queries';
import { LoadError } from '@/features/profile/components/LoadError/LoadError';
import { ProfileSection } from '@/features/profile/components/ProfileSection/ProfileSection';
import { SectionSkeleton } from '@/features/profile/components/SectionSkeleton/SectionSkeleton';
import { VocabularyStats } from './VocabularyStats';
import { WeakAreasList } from './WeakAreasList';

interface LearnerModelBodyProps {
  model: LearnerModel;
}

function LearnerModelBody({ model }: LearnerModelBodyProps) {
  const { t } = useTranslation();
  const hasWords = WORD_STATES.some((state) => model.vocabulary[state] > 0);

  if (model.weakAreas.length === 0 && !hasWords) {
    return <Text>{t('profile.learnerModel.empty')}</Text>;
  }

  return (
    <Stack gap="lg">
      <WeakAreasList weakAreas={model.weakAreas} />
      <VocabularyStats vocabulary={model.vocabulary} />
    </Stack>
  );
}

export function LearnerModelSection() {
  const { t } = useTranslation();
  const model = useQuery(learnerModelQueryOptions());

  return (
    <ProfileSection title={t('profile.learnerModel.title')}>
      {model.isPending && <SectionSkeleton />}
      {model.isError && <LoadError onRetry={() => void model.refetch()} />}
      {model.data && <LearnerModelBody model={model.data} />}
    </ProfileSection>
  );
}
