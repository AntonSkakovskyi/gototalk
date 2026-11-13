import { MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { Button, Stack, Text, TextInput } from '@mantine/core';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StepFieldset } from '@/features/profile/components/StepFieldset/StepFieldset';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';
import {
  goalErrorMessage,
  type OnboardingFormValues,
} from '@/features/profile/lib/onboarding-form';
import classes from './GoalInputs.module.scss';

interface GoalInputsProps {
  focusOnMount: boolean;
}

export function GoalInputs({ focusOnMount }: GoalInputsProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const {
    control,
    register,
    formState: { errors, touchedFields, isSubmitted },
  } = useFormContext<OnboardingFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'goals' });

  return (
    <StepFieldset
      title={t('profile.onboarding.goals.title')}
      hint={t('profile.onboarding.goals.hint', { max: MAX_ACTIVE_GOALS })}
      focusOnMount={focusOnMount}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('profile.onboarding.goals.examples')}
        </Text>
        {fields.map((field, index) => {
          // A freshly added row stays quiet until it is touched or the form is submitted.
          const reveal =
            isSubmitted || touchedFields.goals?.[index]?.title === true;
          const error = reveal
            ? goalErrorMessage(errors.goals?.[index]?.title)
            : null;
          const position = index + 1;
          return (
            <div key={field.id} className={classes.goal}>
              <TextInput
                size="lg"
                label={t('profile.onboarding.goals.fieldLabel', {
                  index: position,
                })}
                placeholder={t('profile.onboarding.goals.placeholder')}
                error={errorText(error)}
                errorProps={ANNOUNCED_ERROR_PROPS}
                {...register(`goals.${index}.title`)}
              />
              {fields.length > 1 && (
                <Button
                  variant="subtle"
                  color="red"
                  size="lg"
                  className={classes.remove}
                  onClick={() => remove(index)}
                >
                  {t('profile.onboarding.goals.remove', { index: position })}
                </Button>
              )}
            </div>
          );
        })}
        {fields.length < MAX_ACTIVE_GOALS && (
          <Button
            variant="light"
            size="lg"
            fullWidth
            onClick={() => append({ title: '' })}
          >
            {t('profile.onboarding.goals.add')}
          </Button>
        )}
      </Stack>
    </StepFieldset>
  );
}
