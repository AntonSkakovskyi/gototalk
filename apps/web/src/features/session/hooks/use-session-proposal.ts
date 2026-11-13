import {
  MAX_TOPIC_REROLLS,
  type FeedbackMode,
  type SessionDetails,
} from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { sessionPlanQueryOptions } from '@/features/session/api/session-queries';
import { useStartSession } from './use-start-session';

export function useSessionProposal() {
  const [shownTopics, setShownTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState<string>();
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('immediate');
  const plan = useQuery(
    sessionPlanQueryOptions({ previousTopics: shownTopics, customTopic }),
  );
  const mutation = useStartSession();

  const rerolls = shownTopics.length;
  const canReroll =
    customTopic === undefined &&
    plan.data !== undefined &&
    rerolls < MAX_TOPIC_REROLLS;

  function requestAnotherTopic() {
    if (canReroll && plan.data !== undefined) {
      setShownTopics([...shownTopics, plan.data.topic]);
    }
  }

  function applyCustomTopic(topic: string) {
    const trimmed = topic.trim();
    setCustomTopic(trimmed === '' ? undefined : trimmed);
  }

  function start(onStarted: (details: SessionDetails) => void) {
    if (plan.data === undefined) {
      return;
    }
    const { topic, topicSource, questions } = plan.data;
    mutation.mutate(
      { topic, topicSource, questions, feedbackMode },
      { onSuccess: (details) => onStarted(details) },
    );
  }

  return {
    plan,
    rerolls,
    maxRerolls: MAX_TOPIC_REROLLS,
    canReroll,
    customTopic,
    feedbackMode,
    setFeedbackMode,
    requestAnotherTopic,
    applyCustomTopic,
    clearCustomTopic: () => setCustomTopic(undefined),
    start,
    isStarting: mutation.isPending,
    startError: mutation.error,
  };
}
