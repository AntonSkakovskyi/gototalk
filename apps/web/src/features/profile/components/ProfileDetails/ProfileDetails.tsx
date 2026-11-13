import type { Profile } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { profileQueryOptions } from '@/features/profile/api/profile-queries';
import { LoadError } from '@/shared/ui/LoadError/LoadError';
import { ProfileSection } from '@/features/profile/components/ProfileSection/ProfileSection';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';
import { useInlineEdit } from '@/features/profile/hooks/use-inline-edit';
import { ProfileEditForm } from './ProfileEditForm';
import { ProfileView } from './ProfileView';

interface ProfileBodyProps {
  profile: Profile;
}

function ProfileBody({ profile }: ProfileBodyProps) {
  const edit = useInlineEdit();

  return edit.editing ? (
    <ProfileEditForm profile={profile} onDone={edit.finish} />
  ) : (
    <ProfileView
      profile={profile}
      onEdit={edit.start}
      editButtonRef={edit.triggerRef}
    />
  );
}

export function ProfileDetails() {
  const { t } = useTranslation();
  const profile = useQuery(profileQueryOptions());

  return (
    <ProfileSection title={t('profile.details.title')}>
      {profile.isPending && <SectionSkeleton />}
      {profile.isError && <LoadError onRetry={() => void profile.refetch()} />}
      {profile.data && <ProfileBody profile={profile.data} />}
    </ProfileSection>
  );
}
