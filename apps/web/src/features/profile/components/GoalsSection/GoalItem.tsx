import type { Goal, GoalStatus } from '@gototalk/shared';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import type { GoalActions } from '@/features/profile/hooks/use-goal-actions';
import { useInlineEdit } from '@/features/profile/hooks/use-inline-edit';
import { DeleteGoalDialog } from './DeleteGoalDialog';
import { GoalTitleForm } from './GoalTitleForm';
import classes from './GoalsSection.module.scss';

interface GoalItemProps {
  goal: Goal;
  actions: GoalActions;
}

export function GoalItem({ goal, actions }: GoalItemProps) {
  const { t } = useTranslation();
  const edit = useInlineEdit();
  const [deleting, { open: askDelete, close: cancelDelete }] =
    useDisclosure(false);
  const isActive = goal.status === 'active';
  const statusAction = isActive ? 'markDone' : 'reopen';
  const toggledStatus: GoalStatus = isActive ? 'done' : 'active';

  if (edit.editing) {
    return (
      <Paper component="li" withBorder p="md">
        <GoalTitleForm
          title={goal.title}
          pending={actions.isPending}
          onSubmit={(title) => actions.rename(goal.id, title, edit.finish)}
          onCancel={edit.finish}
        />
      </Paper>
    );
  }

  return (
    <Paper component="li" withBorder p="md">
      <Stack gap="sm">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          gap="sm"
        >
          <Text className={classes.title}>{goal.title}</Text>
          <Badge variant="light" color={isActive ? 'blue' : 'green'} tt="none">
            {t(`profile.goals.status.${goal.status}`)}
          </Badge>
        </Group>
        <Group gap="xs">
          <Button
            variant="light"
            classNames={{ root: classes.action }}
            disabled={actions.isPending}
            aria-label={t(`profile.goals.actions.${statusAction}Label`, {
              title: goal.title,
            })}
            onClick={() => actions.setStatus(goal.id, toggledStatus)}
          >
            {t(`profile.goals.actions.${statusAction}`)}
          </Button>
          <Button
            ref={edit.triggerRef}
            variant="default"
            classNames={{ root: classes.action }}
            aria-label={t('profile.goals.actions.editLabel', {
              title: goal.title,
            })}
            onClick={edit.start}
          >
            {t('profile.actions.edit')}
          </Button>
          <Button
            variant="subtle"
            color="red"
            classNames={{ root: classes.action }}
            aria-label={t('profile.goals.actions.deleteLabel', {
              title: goal.title,
            })}
            onClick={askDelete}
          >
            {t('profile.actions.delete')}
          </Button>
        </Group>
      </Stack>
      <DeleteGoalDialog
        opened={deleting}
        title={goal.title}
        onConfirm={() => {
          cancelDelete();
          actions.remove(goal.id);
        }}
        onClose={cancelDelete}
      />
    </Paper>
  );
}
