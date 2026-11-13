import { MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { Button, Stack, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import type { GoalActions } from '@/features/profile/hooks/use-goal-actions';
import { useGoalTitleForm } from '@/features/profile/hooks/use-goal-title-form';
import { ANNOUNCED_ERROR_PROPS } from '@/features/profile/lib/field-error-props';

interface AddGoalFormProps {
  actions: GoalActions;
  limitReached: boolean;
}

export function AddGoalForm({ actions, limitReached }: AddGoalFormProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const form = useGoalTitleForm('', (title) =>
    actions.add(title, () => form.reset()),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <Stack gap="sm">
        <TextInput
          size="lg"
          label={t('profile.goals.add.label')}
          placeholder={t('profile.goals.add.placeholder')}
          description={
            limitReached
              ? t('profile.goals.add.limitHint', { max: MAX_ACTIVE_GOALS })
              : undefined
          }
          disabled={limitReached}
          error={errorText(form.error)}
          errorProps={ANNOUNCED_ERROR_PROPS}
          {...form.field}
        />
        <Button
          type="submit"
          variant="light"
          size="lg"
          disabled={limitReached || actions.isPending}
        >
          {t('profile.goals.add.submit')}
        </Button>
      </Stack>
    </form>
  );
}
