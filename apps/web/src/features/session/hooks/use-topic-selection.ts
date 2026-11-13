import { MAX_TOPIC_REROLLS } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { sessionPlanQueryOptions } from '@/features/session/api/session-queries';

export function useTopicSelection(onTopicChange: () => void) {
  const [shownTopics, setShownTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState<string>();
  const [topicChanged, setTopicChanged] = useState(false);
  const plan = useQuery(
    sessionPlanQueryOptions({ previousTopics: shownTopics, customTopic }),
  );

  const rerolls = shownTopics.length;
  const canReroll =
    customTopic === undefined &&
    plan.data !== undefined &&
    rerolls < MAX_TOPIC_REROLLS;

  function changeTopic(next: () => void) {
    onTopicChange();
    setTopicChanged(true);
    next();
  }

  function requestAnotherTopic() {
    if (canReroll && plan.data !== undefined) {
      const { topic } = plan.data;
      changeTopic(() => setShownTopics([...shownTopics, topic]));
    }
  }

  function applyCustomTopic(topic: string) {
    const trimmed = topic.trim();
    changeTopic(() => setCustomTopic(trimmed === '' ? undefined : trimmed));
  }

  function clearCustomTopic() {
    changeTopic(() => setCustomTopic(undefined));
  }

  return {
    plan,
    rerolls,
    maxRerolls: MAX_TOPIC_REROLLS,
    canReroll,
    customTopic,
    topicChanged,
    requestAnotherTopic,
    applyCustomTopic,
    clearCustomTopic,
  };
}
