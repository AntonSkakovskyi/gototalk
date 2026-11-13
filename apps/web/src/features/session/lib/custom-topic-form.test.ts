import { TOPIC_MAX } from '@gototalk/shared';
import { customTopicSchema, topicErrorMessage } from './custom-topic-form';

function firstIssueCode(topic: string) {
  const result = customTopicSchema.safeParse({ topic });
  return result.success ? undefined : result.error.issues[0]?.code;
}

describe('customTopicSchema', () => {
  it('trims the topic', () => {
    expect(customTopicSchema.parse({ topic: '  My cat  ' })).toEqual({
      topic: 'My cat',
    });
  });

  it('rejects empty and whitespace-only topics as too small', () => {
    expect(firstIssueCode('')).toBe('too_small');
    expect(firstIssueCode('   ')).toBe('too_small');
  });

  it('rejects a topic over the maximum as too big', () => {
    expect(firstIssueCode('a'.repeat(TOPIC_MAX + 1))).toBe('too_big');
    expect(firstIssueCode('a'.repeat(TOPIC_MAX))).toBeUndefined();
  });
});

describe('topicErrorMessage', () => {
  it('maps no error to nothing', () => {
    expect(topicErrorMessage(undefined)).toBeUndefined();
  });

  it('maps too_big to the too long message with the maximum', () => {
    expect(topicErrorMessage({ type: 'too_big' })).toEqual({
      key: 'session.proposal.custom.errors.tooLong',
      values: { max: TOPIC_MAX },
    });
  });

  it('maps every other issue to the required message', () => {
    expect(topicErrorMessage({ type: 'too_small' })).toEqual({
      key: 'session.proposal.custom.errors.required',
    });
  });
});
