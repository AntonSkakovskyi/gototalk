import { zodResolver } from '@hookform/resolvers/zod';
import {
  UpdateProfileRequestSchema,
  type Profile,
  type UpdateProfileRequest,
} from '@gototalk/shared';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useSceneDraft } from '@/features/profile/hooks/use-scene-draft';
import { useUpdateProfile } from '@/features/profile/hooks/use-update-profile';
import {
  profileErrorKey,
  type ProfileErrorMessage,
} from '@/features/profile/lib/profile-errors';

export function useProfileEditForm(profile: Profile, onSaved: () => void) {
  const form = useForm<UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    defaultValues: { level: profile.level, scenes: profile.scenes },
    mode: 'onChange',
  });
  const sceneDraft = useSceneDraft(form);
  const update = useUpdateProfile();
  const [error, setError] = useState<ProfileErrorMessage | null>(null);

  const save = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await update.mutateAsync(values);
      onSaved();
    } catch (failure) {
      setError(profileErrorKey(failure));
    }
  });

  // An unsent custom scene is added before saving instead of being silently dropped.
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sceneDraft.commit()) {
      await save(event);
    }
  };

  return { form, sceneDraft, error, isPending: update.isPending, onSubmit };
}
