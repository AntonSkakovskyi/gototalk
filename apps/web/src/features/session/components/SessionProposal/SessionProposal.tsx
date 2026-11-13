import { Alert, Button, Stack } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSessionProposal } from '@/features/session/hooks/use-session-proposal';
import { sessionErrorKey } from '@/features/session/lib/session-errors';
import { CustomTopicAction } from './CustomTopicAction';
import { FeedbackModeControl } from './FeedbackModeControl';
import { ProposalPlan } from './ProposalPlan';
import classes from './SessionProposal.module.scss';
import { TopicActions } from './TopicActions';

export function SessionProposal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const proposal = useSessionProposal();
  const [returnedToSuggested, setReturnedToSuggested] = useState(false);
  const { plan, isStarting } = proposal;

  function handleStart() {
    proposal.start(
      (details) => void navigate(`/sessions/${details.id}`, { replace: true }),
    );
  }

  function applyCustomTopic(topic: string) {
    setReturnedToSuggested(false);
    proposal.applyCustomTopic(topic);
  }

  function backToSuggested() {
    setReturnedToSuggested(true);
    proposal.clearCustomTopic();
  }

  return (
    <Stack gap="lg">
      <ProposalPlan
        plan={plan}
        focusTopic={proposal.rerolls > 0 || returnedToSuggested}
      />
      <Stack gap="md">
        <TopicActions
          customActive={proposal.customTopic !== undefined}
          canReroll={proposal.canReroll}
          rerollsLeft={proposal.maxRerolls - proposal.rerolls}
          disabled={isStarting}
          onReroll={proposal.requestAnotherTopic}
          onBackToSuggested={backToSuggested}
        />
        <CustomTopicAction disabled={isStarting} onApply={applyCustomTopic} />
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
