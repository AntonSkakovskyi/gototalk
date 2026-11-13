import { Alert, Button, Stack, Text } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSessionProposal } from '@/features/session/hooks/use-session-proposal';
import { sessionErrorKey } from '@/features/session/lib/session-errors';
import { FeedbackModeControl } from './FeedbackModeControl';
import { ProposalPlan } from './ProposalPlan';
import classes from './SessionProposal.module.scss';

export function SessionProposal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const proposal = useSessionProposal();
  const rerollsHintId = useId();
  const { plan, isStarting } = proposal;
  const left = proposal.maxRerolls - proposal.rerolls;

  function handleStart() {
    proposal.start(
      (details) => void navigate(`/sessions/${details.id}`, { replace: true }),
    );
  }

  return (
    <Stack gap="lg">
      <ProposalPlan plan={plan} focusTopic={proposal.rerolls > 0} />
      <Stack gap="xs">
        <Button
          variant="default"
          size="lg"
          aria-describedby={rerollsHintId}
          disabled={!proposal.canReroll || isStarting}
          onClick={proposal.requestAnotherTopic}
        >
          {t('session.proposal.anotherTopic')}
        </Button>
        <Text id={rerollsHintId} size="sm" c="dimmed" ta="center">
          {left > 0
            ? t('session.proposal.rerollsLeft', { left })
            : t('session.proposal.rerollsExhausted')}
        </Text>
      </Stack>
      <FeedbackModeControl
        value={proposal.feedbackMode}
        onChange={proposal.setFeedbackMode}
        disabled={isStarting}
      />
      <Stack gap="sm" className={classes.actions}>
        {proposal.startError && (
          <Alert color="red" role="alert">
            {t(sessionErrorKey(proposal.startError).key)}
          </Alert>
        )}
        <Button
          size="lg"
          fullWidth
          loading={isStarting}
          disabled={plan.data === undefined}
          onClick={handleStart}
        >
          {t('session.proposal.start')}
        </Button>
      </Stack>
    </Stack>
  );
}
