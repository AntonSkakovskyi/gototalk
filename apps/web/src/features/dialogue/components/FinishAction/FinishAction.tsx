import type { SessionDetails } from '@gototalk/shared';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AnswerError } from '@/features/dialogue/components/AnswerError/AnswerError';
import { useFinishSession } from '@/features/dialogue/hooks/use-finish-session';
import { reportPath } from '@/shared/router/session-paths';

interface FinishActionProps {
  details: SessionDetails;
  disabled: boolean;
}

export function FinishAction({ details, disabled }: FinishActionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const { finish, isFinishing, error, reset } = useFinishSession(details.id);

  // Stay mounted for a finished session: unmounting would drop the per-call callback that navigates.
  if (details.status !== 'active') {
    return null;
  }

  const openConfirmation = () => {
    reset();
    open();
  };

  return (
    <>
      <Button
        size="lg"
        variant={details.planRemaining === 0 ? 'filled' : 'outline'}
        disabled={disabled}
        onClick={openConfirmation}
      >
        {t('dialogue.finish.open')}
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        closeOnEscape={!isFinishing}
        closeOnClickOutside={!isFinishing}
        withCloseButton={!isFinishing}
        title={t('dialogue.finish.title')}
        centered
      >
        <Stack gap="md">
          <Text>{t('dialogue.finish.text')}</Text>
          <AnswerError error={error} />
          <Group grow gap="sm">
            <Button
              variant="default"
              size="lg"
              disabled={isFinishing}
              onClick={close}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              size="lg"
              loading={isFinishing}
              onClick={() =>
                finish(() => void navigate(reportPath(details.id)))
              }
            >
              {t('common.actions.finish')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
