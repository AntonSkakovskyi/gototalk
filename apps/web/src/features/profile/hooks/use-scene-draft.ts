import { useState } from 'react';
import { addCustomScene } from '@/features/profile/lib/onboarding-form';
import type { ProfileErrorMessage } from '@/features/profile/lib/profile-errors';

interface ScenesForm {
  getValues: (name: 'scenes') => string[];
  setValue: (
    name: 'scenes',
    scenes: string[],
    options: { shouldDirty: boolean; shouldValidate: boolean },
  ) => void;
}

export function useSceneDraft(form: ScenesForm) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<ProfileErrorMessage | null>(null);

  const change = (next: string) => {
    setValue(next);
    setError(null);
  };

  const add = (): boolean => {
    const result = addCustomScene(value, form.getValues('scenes'));
    if ('error' in result) {
      setError(result.error);
      return false;
    }
    form.setValue('scenes', result.scenes, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('');
    setError(null);
    return true;
  };

  // An unsent draft is added on step change instead of being silently dropped.
  const commit = () => value.trim() === '' || add();

  return { value, error, change, add, commit };
}

export type SceneDraft = ReturnType<typeof useSceneDraft>;
