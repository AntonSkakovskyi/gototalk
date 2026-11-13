import { Button, Stack, Text } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface TopicActionsProps {
  customActive: boolean;
  canReroll: boolean;
  rerollsLeft: number;
  disabled: boolean;
  onReroll: () => void;
  onBackToSuggested: () => void;
}

export function TopicActions({
  customActive,
  canReroll,
  rerollsLeft,
  disabled,
  onReroll,
  onBackToSuggested,
}: TopicActionsProps) {
  const { t } = useTranslation();
  const hintId = useId();

  if (customActive) {
    return (
      <Button
        variant="light"
        size="lg"
        disabled={disabled}
        onClick={onBackToSuggested}
      >
        {t('session.proposal.custom.back')}
      </Button>
    );
  }

  return (
    <Stack gap="xs">
      <Button
        variant="default"
        size="lg"
        aria-describedby={hintId}
        disabled={!canReroll || disabled}
        onClick={onReroll}
      >
        {t('session.proposal.anotherTopic')}
      </Button>
      <Text id={hintId} size="sm" c="dimmed" ta="center">
        {rerollsLeft > 0
          ? t('session.proposal.rerollsLeft', { left: rerollsLeft })
          : t('session.proposal.rerollsExhausted')}
      </Text>
    </Stack>
  );
}
