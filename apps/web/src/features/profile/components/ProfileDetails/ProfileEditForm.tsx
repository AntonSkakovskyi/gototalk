import type { Profile } from '@gototalk/shared';
import { Alert, Button, Group, Stack } from '@mantine/core';
import { FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LevelPicker } from '@/features/profile/components/LevelPicker/LevelPicker';
import { ScenePicker } from '@/features/profile/components/ScenePicker/ScenePicker';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { useProfileEditForm } from '@/features/profile/hooks/use-profile-edit-form';

interface ProfileEditFormProps {
  profile: Profile;
  onDone: () => void;
}

export function ProfileEditForm({ profile, onDone }: ProfileEditFormProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const edit = useProfileEditForm(profile, onDone);

  return (
    <FormProvider {...edit.form}>
      <form onSubmit={(event) => void edit.onSubmit(event)} noValidate>
        <Stack gap="lg">
          {edit.error && (
            <Alert color="red" role="alert">
              {errorText(edit.error)}
            </Alert>
          )}
          <LevelPicker hint={t('profile.details.levelHint')} focusOnMount />
          <ScenePicker draft={edit.sceneDraft} focusOnMount={false} />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              size="lg"
              disabled={edit.isPending}
              onClick={onDone}
            >
              {t('profile.actions.cancel')}
            </Button>
            <Button type="submit" size="lg" loading={edit.isPending}>
              {t('profile.actions.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </FormProvider>
  );
}
