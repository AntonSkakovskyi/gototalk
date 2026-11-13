import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { useGoalTitleForm } from '@/features/profile/hooks/use-goal-title-form';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';

interface GoalTitleFormProps {
  title: string;
  pending: boolean;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

export function GoalTitleForm({
  title,
  pending,
  onSubmit,
  onCancel,
}: GoalTitleFormProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const form = useGoalTitleForm(title, onSubmit);
  const { setFocus } = form;

  useEffect(() => setFocus('title'), [setFocus]);

  return (
    <form onSubmit={form.onSubmit} noValidate>
      <Stack gap="md">
        <TextInput
          size="lg"
          label={t('profile.goals.edit.label')}
          error={errorText(form.error)}
          errorProps={ANNOUNCED_ERROR_PROPS}
          {...form.field}
        />
        <Group justify="flex-end" gap="sm">
          <Button
            variant="default"
            size="lg"
            disabled={pending}
            onClick={onCancel}
          >
            {t('profile.actions.cancel')}
          </Button>
          <Button type="submit" size="lg" loading={pending}>
            {t('profile.actions.save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
