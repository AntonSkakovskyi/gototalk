import {
  FEEDBACK_MODES,
  FeedbackModeSchema,
  type FeedbackMode,
} from '@gototalk/shared';
import { SegmentedControl, Stack, Text } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './FeedbackModeControl.module.scss';

interface FeedbackModeControlProps {
  value: FeedbackMode;
  onChange: (mode: FeedbackMode) => void;
  disabled: boolean;
}

export function FeedbackModeControl({
  value,
  onChange,
  disabled,
}: FeedbackModeControlProps) {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <Stack gap="xs">
      <Text id={labelId} size="sm" fw={500}>
        {t('session.proposal.feedbackMode.label')}
      </Text>
      <SegmentedControl
        aria-labelledby={labelId}
        size="md"
        classNames={{ label: classes.label }}
        fullWidth
        value={value}
        disabled={disabled}
        onChange={(mode) => onChange(FeedbackModeSchema.parse(mode))}
        data={FEEDBACK_MODES.map((mode) => ({
          value: mode,
          label: t(`session.proposal.feedbackMode.${mode}`),
        }))}
      />
    </Stack>
  );
}
