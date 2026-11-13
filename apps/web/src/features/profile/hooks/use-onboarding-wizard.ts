import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useOnboardingSubmit } from '@/features/profile/hooks/use-onboarding-submit';
import { useSceneDraft } from '@/features/profile/hooks/use-scene-draft';
import {
  ONBOARDING_DEFAULTS,
  ONBOARDING_STEPS,
  onboardingSchema,
  type OnboardingFormValues,
  type OnboardingValues,
} from '@/features/profile/lib/onboarding-form';

export function useOnboardingWizard(onCompleted: () => void) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const form = useForm<OnboardingFormValues, unknown, OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: ONBOARDING_DEFAULTS,
    mode: 'onChange',
  });
  const sceneDraft = useSceneDraft(form);
  const submission = useOnboardingSubmit(form, onCompleted);
  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const moveTo = (index: number) => {
    setStepIndex(index);
    setHasNavigated(true);
  };

  const goNext = async () => {
    if (step === 'scenes' && !sceneDraft.commit()) {
      return;
    }
    if (await form.trigger(step)) {
      moveTo(stepIndex + 1);
    }
  };

  const goBack = () => moveTo(Math.max(stepIndex - 1, 0));

  // Enter on an earlier step advances instead of submitting a half-filled form.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return isLast ? submission.submit() : goNext();
  };

  return {
    form,
    sceneDraft,
    step,
    stepNumber: stepIndex + 1,
    isLast,
    focusStep: hasNavigated,
    isPending: submission.isPending,
    isRetry: submission.isRetry,
    submitError: submission.error,
    goBack,
    goNext,
    onSubmit,
  };
}
