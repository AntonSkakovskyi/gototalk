import type { TopicSource } from '@gototalk/shared';
import { ENGLISH_LANG } from '@/shared/i18n/languages';

// Suggested topics are English; a custom topic is the user's own text in any language.
export function topicLanguage(topicSource: TopicSource): string | undefined {
  return topicSource === 'suggested' ? ENGLISH_LANG : undefined;
}
