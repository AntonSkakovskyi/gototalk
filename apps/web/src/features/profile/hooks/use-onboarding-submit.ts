import { useState } from 'react';
import { useCompleteOnboarding } from '@/features/profile/hooks/use-complete-onboarding';
import {
  toOnboardingInput,
  type OnboardingForm,
} from '@/features/profile/lib/onboarding-form';
import { profileErrorKey } from '@/features/profile/lib/profile-errors';

export function useOnboardingSubmit(
  form: OnboardingForm,
  onCompleted: () => void,
) {
  const complete = useCompleteOnboarding();
  const [hasFailed, setHasFailed] = useState(false);

  const submit = form.handleSubmit((values) =>
    complete.mutate(toOnboardingInput(values), {
      onSuccess: onCompleted,
      onError: () => setHasFailed(true),
    }),
  );

  return {
    submit,
    isPending: complete.isPending,
    isRetry: hasFailed,
    error: complete.isError ? profileErrorKey(complete.error) : null,
  };
}
