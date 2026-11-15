import { Stack } from '@mantine/core';
import { useNavigate } from 'react-router';
import { useSessionProposal } from '@/features/session/hooks/use-session-proposal';
import { sessionPath } from '@/entities/session/lib/session-paths';
import { CustomTopicAction } from './CustomTopicAction';
import { FeedbackModeControl } from './FeedbackModeControl';
import { ProposalPlan } from './ProposalPlan';
import { StartAction } from './StartAction';
import { TopicActions } from './TopicActions';

export function SessionProposal() {
  const navigate = useNavigate();
  const proposal = useSessionProposal();
  const { plan, isStarting } = proposal;

  function handleStart() {
    proposal.start(
      (details) => void navigate(sessionPath(details.id), { replace: true }),
    );
  }

  return (
    <Stack gap="lg">
      <ProposalPlan plan={plan} focusTopic={proposal.topicChanged} />
      <Stack gap="md">
        <TopicActions
          customActive={proposal.customTopic !== undefined}
          canReroll={proposal.canReroll}
          rerollsLeft={proposal.maxRerolls - proposal.rerolls}
          disabled={isStarting}
          onReroll={proposal.requestAnotherTopic}
          onBackToSuggested={proposal.clearCustomTopic}
        />
        <CustomTopicAction
          disabled={isStarting}
          onApply={proposal.applyCustomTopic}
        />
      </Stack>
      <FeedbackModeControl
        value={proposal.feedbackMode}
        onChange={proposal.setFeedbackMode}
        disabled={isStarting}
      />
      <StartAction
        error={proposal.startError}
        loading={isStarting}
        disabled={plan.data === undefined}
        onStart={handleStart}
      />
    </Stack>
  );
}
