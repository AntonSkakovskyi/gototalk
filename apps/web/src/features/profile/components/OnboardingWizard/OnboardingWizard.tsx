import { Alert, Button, Progress, Stack, Text } from '@mantine/core';
import { FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { GoalInputs } from '@/features/profile/components/GoalInputs/GoalInputs';
import { LevelPicker } from '@/features/profile/components/LevelPicker/LevelPicker';
import { ScenePicker } from '@/features/profile/components/ScenePicker/ScenePicker';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { useOnboardingWizard } from '@/features/profile/hooks/use-onboarding-wizard';
import { ONBOARDING_STEPS } from '@/features/profile/lib/onboarding-form';
import classes from './OnboardingWizard.module.scss';

interface OnboardingWizardProps {
  onCompleted: () => void;
}

export function OnboardingWizard({ onCompleted }: OnboardingWizardProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const wizard = useOnboardingWizard(onCompleted);
  const { step, stepNumber, isLast, focusStep } = wizard;
  const { isPending, isRetry, submitError } = wizard;
  const total = ONBOARDING_STEPS.length;

  return (
    <FormProvider {...wizard.form}>
      <form onSubmit={(event) => void wizard.onSubmit(event)} noValidate>
        <Stack gap="lg">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {t('profile.onboarding.progress', {
                current: stepNumber,
                total,
              })}
            </Text>
            <Progress
              value={(stepNumber / total) * 100}
              aria-label={t('profile.onboarding.progressLabel')}
            />
          </Stack>
          {submitError && (
            <Alert color="red" role="alert">
              {errorText(submitError)}
            </Alert>
          )}
          {step === 'level' && <LevelPicker focusOnMount={focusStep} />}
          {step === 'scenes' && (
            <ScenePicker draft={wizard.sceneDraft} focusOnMount={focusStep} />
          )}
          {step === 'goals' && <GoalInputs focusOnMount={focusStep} />}
          <div className={classes.actions}>
            {stepNumber > 1 && (
              <Button
                variant="default"
                size="lg"
                disabled={isPending}
                onClick={wizard.goBack}
              >
                {t('profile.onboarding.actions.back')}
              </Button>
            )}
            {isLast ? (
              <Button key="finish" type="submit" size="lg" loading={isPending}>
                {t(
                  isRetry
                    ? 'profile.onboarding.actions.retry'
                    : 'profile.onboarding.actions.finish',
                )}
              </Button>
            ) : (
              <Button key="next" size="lg" onClick={() => void wizard.goNext()}>
                {t('profile.onboarding.actions.next')}
              </Button>
            )}
          </div>
        </Stack>
      </form>
    </FormProvider>
  );
}
