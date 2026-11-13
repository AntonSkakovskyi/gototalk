import { MAX_SCENES, SCENE_PRESETS, isScenePreset } from '@gototalk/shared';
import { Button, Chip, Stack, TextInput } from '@mantine/core';
import type { KeyboardEvent } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StepFieldset } from '@/features/profile/components/StepFieldset/StepFieldset';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';
import type { SceneDraft } from '@/features/profile/hooks/use-scene-draft';
import {
  scenesErrorMessage,
  type OnboardingFormValues,
} from '@/features/profile/lib/onboarding-form';
import classes from './ScenePicker.module.scss';

interface ScenePickerProps {
  draft: SceneDraft;
  focusOnMount: boolean;
}

export function ScenePicker({ draft, focusOnMount }: ScenePickerProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { field, fieldState } = useController<OnboardingFormValues, 'scenes'>({
    name: 'scenes',
  });
  const customScenes = field.value.filter((scene) => !isScenePreset(scene));

  // Enter would otherwise submit the wizard form instead of adding the scene.
  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      draft.add();
    }
  };

  return (
    <StepFieldset
      title={t('profile.onboarding.scenes.title')}
      hint={t('profile.onboarding.scenes.hint', { max: MAX_SCENES })}
      error={scenesErrorMessage(fieldState.error)}
      focusOnMount={focusOnMount}
    >
      <Stack gap="md">
        <Chip.Group multiple value={field.value} onChange={field.onChange}>
          <div className={classes.chips}>
            {[...SCENE_PRESETS, ...customScenes].map((scene) => (
              <Chip
                key={scene}
                value={scene}
                size="xl"
                classNames={{ root: classes.root, label: classes.chip }}
              >
                {isScenePreset(scene)
                  ? t(`profile.scenes.presets.${scene}`)
                  : scene}
              </Chip>
            ))}
          </div>
        </Chip.Group>
        <TextInput
          size="lg"
          label={t('profile.onboarding.scenes.customLabel')}
          placeholder={t('profile.onboarding.scenes.customPlaceholder')}
          value={draft.value}
          error={errorText(draft.error)}
          errorProps={ANNOUNCED_ERROR_PROPS}
          onChange={(event) => draft.change(event.currentTarget.value)}
          onKeyDown={onDraftKeyDown}
        />
        <Button variant="light" size="lg" fullWidth onClick={draft.add}>
          {t('profile.onboarding.scenes.add')}
        </Button>
      </Stack>
    </StepFieldset>
  );
}
