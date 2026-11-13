import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateGoalRequestSchema,
  type CreateGoalRequest,
} from '@gototalk/shared';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { goalErrorMessage } from '@/features/profile/lib/onboarding-form';

export function useGoalTitleForm(
  initialTitle: string,
  onTitle: (title: string) => void,
) {
  const form = useForm<CreateGoalRequest>({
    resolver: zodResolver(CreateGoalRequestSchema),
    defaultValues: { title: initialTitle },
  });

  return {
    field: form.register('title'),
    reset: form.reset,
    setFocus: form.setFocus,
    error: goalErrorMessage(form.formState.errors.title),
    onSubmit: (event: FormEvent<HTMLFormElement>) =>
      void form.handleSubmit(({ title }) => onTitle(title))(event),
  };
}
