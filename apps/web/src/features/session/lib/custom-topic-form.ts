import { TOPIC_MAX, TopicSchema } from '@gototalk/shared';
import { z } from 'zod';
import type { TranslationKey } from '@/shared/i18n/translation-key';

export const customTopicSchema = z.object({ topic: TopicSchema });

export type CustomTopicValues = z.infer<typeof customTopicSchema>;

interface FieldIssue {
  type?: string;
}

interface TopicErrorMessage {
  key: TranslationKey;
  values?: { max: number };
}

const ERRORS = 'session.proposal.custom.errors';

export function topicErrorMessage(
  error: FieldIssue | undefined,
): TopicErrorMessage | undefined {
  if (!error) {
    return undefined;
  }
  return error.type === 'too_big'
    ? { key: `${ERRORS}.tooLong`, values: { max: TOPIC_MAX } }
    : { key: `${ERRORS}.required` };
}
