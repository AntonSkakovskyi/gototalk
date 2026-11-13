import type { FeedbackMode, SessionDetails } from '@gototalk/shared';
import { useState } from 'react';
import { useStartSession } from './use-start-session';
import { useTopicSelection } from './use-topic-selection';

export function useSessionProposal() {
  const mutation = useStartSession();
  const topics = useTopicSelection(mutation.reset);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('immediate');
  const { plan } = topics;

  function changeFeedbackMode(mode: FeedbackMode) {
    mutation.reset();
    setFeedbackMode(mode);
  }

  function start(onStarted: (details: SessionDetails) => void) {
    if (plan.data === undefined) {
      return;
    }
    const { topic, topicSource, questions } = plan.data;
    mutation.mutate(
      { topic, topicSource, questions, feedbackMode },
      { onSuccess: onStarted },
    );
  }

  return {
    ...topics,
    feedbackMode,
    setFeedbackMode: changeFeedbackMode,
    start,
    isStarting: mutation.isPending,
    startError: mutation.error,
  };
}
