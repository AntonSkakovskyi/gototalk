import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { goalsQueryOptions } from '@/features/profile/api/profile-queries';
import { LoadError } from '@/features/profile/components/LoadError/LoadError';
import { ProfileSection } from '@/features/profile/components/ProfileSection/ProfileSection';
import { SectionSkeleton } from '@/features/profile/components/SectionSkeleton/SectionSkeleton';
import { GoalList } from './GoalList';

export function GoalsSection() {
  const { t } = useTranslation();
  const goals = useQuery(goalsQueryOptions());
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <ProfileSection title={t('profile.goals.title')} titleRef={titleRef}>
      {goals.isPending && <SectionSkeleton />}
      {goals.isError && <LoadError onRetry={() => void goals.refetch()} />}
      {goals.data && (
        <GoalList
          goals={goals.data}
          onRemoved={() => titleRef.current?.focus()}
        />
      )}
    </ProfileSection>
  );
}
