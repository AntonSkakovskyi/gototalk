import type { TopicSource } from '@gototalk/shared';

// Suggested topics are English; a custom topic is the user's own text in any language.
export function topicLanguage(topicSource: TopicSource): string | undefined {
  return topicSource === 'suggested' ? 'en' : undefined;
}
