import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import classes from './GoalsSection.module.scss';

interface DeleteGoalDialogProps {
  opened: boolean;
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteGoalDialog({
  opened,
  title,
  onConfirm,
  onClose,
}: DeleteGoalDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('profile.goals.delete.title')}
      centered
    >
      <Stack gap="md">
        <Text className={classes.wrap}>
          {t('profile.goals.delete.text', { title })}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="lg" data-autofocus onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button color="red" size="lg" onClick={onConfirm}>
            {t('profile.actions.delete')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
