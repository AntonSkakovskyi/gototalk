import { MAX_ACTIVE_GOALS, type Goal } from '@gototalk/shared';
import { Alert, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import { useGoalActions } from '@/features/profile/hooks/use-goal-actions';
import {
  countActiveGoals,
  sortActiveFirst,
} from '@/features/profile/lib/goal-list';
import { AddGoalForm } from './AddGoalForm';
import { GoalItem } from './GoalItem';
import classes from './GoalsSection.module.scss';

interface GoalListProps {
  goals: Goal[];
  onRemoved: () => void;
}

export function GoalList({ goals, onRemoved }: GoalListProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const actions = useGoalActions(onRemoved);
  const active = countActiveGoals(goals);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('profile.goals.counter', { active, max: MAX_ACTIVE_GOALS })}
      </Text>
      {actions.error && (
        <Alert color="red" role="alert">
          {errorText(actions.error)}
        </Alert>
      )}
      {goals.length === 0 ? (
        <Text>{t('profile.goals.empty')}</Text>
      ) : (
        <Stack component="ul" gap="sm" className={classes.list}>
          {sortActiveFirst(goals).map((goal) => (
            <GoalItem key={goal.id} goal={goal} actions={actions} />
          ))}
        </Stack>
      )}
      <AddGoalForm
        actions={actions}
        limitReached={active >= MAX_ACTIVE_GOALS}
      />
    </Stack>
  );
}
