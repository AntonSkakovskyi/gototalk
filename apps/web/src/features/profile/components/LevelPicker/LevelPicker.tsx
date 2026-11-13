import { LEVELS } from '@gototalk/shared';
import { Radio, Stack, Text } from '@mantine/core';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StepFieldset } from '@/features/profile/components/StepFieldset/StepFieldset';
import {
  levelErrorMessage,
  type OnboardingFormValues,
} from '@/features/profile/lib/onboarding-form';
import classes from './LevelPicker.module.scss';

interface LevelPickerProps {
  hint: string;
  focusOnMount: boolean;
}

export function LevelPicker({ hint, focusOnMount }: LevelPickerProps) {
  const { t } = useTranslation();
  const { field, fieldState } = useController<OnboardingFormValues, 'level'>({
    name: 'level',
  });

  return (
    <StepFieldset
      title={t('profile.onboarding.level.title')}
      hint={hint}
      error={levelErrorMessage(fieldState.error)}
      focusOnMount={focusOnMount}
    >
      <Radio.Group value={field.value ?? ''} onChange={field.onChange}>
        <Stack gap="sm">
          {LEVELS.map((level) => (
            <Radio.Card key={level} value={level} className={classes.card}>
              <div className={classes.content}>
                <Radio.Indicator />
                <div>
                  <Text fw={700}>{t(`profile.levels.${level}.title`)}</Text>
                  <Text size="sm" c="dimmed">
                    {t(`profile.levels.${level}.description`)}
                  </Text>
                </div>
              </div>
            </Radio.Card>
          ))}
        </Stack>
      </Radio.Group>
    </StepFieldset>
  );
}
