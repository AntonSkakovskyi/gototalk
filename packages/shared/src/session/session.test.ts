import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_MODES,
  MAX_TOPIC_REROLLS,
  PLAN_QUESTIONS,
  QUESTION_MAX,
  RECENT_SESSIONS_LIMIT,
  SESSION_STATUSES,
  SessionDetailsSchema,
  SessionListSchema,
  SessionPageSchema,
  SessionSchema,
  StartSessionRequestSchema,
  TOPIC_MAX,
  TOPIC_SOURCES,
  TopicSchema,
  UTTERANCE_ROLES,
  UtteranceSchema,
} from '../index.js';

const id = '3f2b8c1e-6d4a-4e0b-9a57-1c2d3e4f5a6b';
const startedAt = '2026-11-13T10:00:00.000Z';

const questionsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => `Question ${i + 1}?`);

const session = {
  id,
  topic: 'Weekend plans',
  topicSource: 'suggested',
  feedbackMode: 'immediate',
  status: 'active',
  startedAt,
  endedAt: null,
};

const utterance = {
  id,
  seq: 1,
  role: 'assistant',
  text: 'Hello!',
  analysisStatus: 'skipped',
  mistakes: [],
  better: [],
};

describe('session constants', () => {
  it('[TC-03-01] constants have the agreed values', () => {
    expect(TOPIC_MAX).toBe(120);
    expect(QUESTION_MAX).toBe(300);
    expect(MAX_TOPIC_REROLLS).toBe(3);
    expect(RECENT_SESSIONS_LIMIT).toBe(10);
    expect(PLAN_QUESTIONS).toBe(5);
    expect(FEEDBACK_MODES).toEqual(['immediate', 'deferred']);
    expect(TOPIC_SOURCES).toEqual(['suggested', 'custom']);
    expect(SESSION_STATUSES).toEqual(['active', 'finished']);
    expect(UTTERANCE_ROLES).toEqual(['assistant', 'user']);
  });
});

describe('TopicSchema', () => {
  it('[TC-03-01] trims and accepts exactly TOPIC_MAX characters', () => {
    expect(TopicSchema.parse(`  ${'a'.repeat(TOPIC_MAX)}  `)).toBe(
      'a'.repeat(TOPIC_MAX),
    );
  });

  it('[TC-03-01] rejects TOPIC_MAX + 1 characters, empty and blank', () => {
    expect(TopicSchema.safeParse('a'.repeat(TOPIC_MAX + 1)).success).toBe(
      false,
    );
    expect(TopicSchema.safeParse('').success).toBe(false);
    expect(TopicSchema.safeParse('   ').success).toBe(false);
  });
});

describe('StartSessionRequestSchema', () => {
  const request = {
    topic: 'Travel',
    topicSource: 'custom',
    questions: questionsOf(PLAN_QUESTIONS),
  };

  it('[TC-03-01] defaults feedbackMode to immediate', () => {
    expect(StartSessionRequestSchema.parse(request).feedbackMode).toBe(
      'immediate',
    );
    expect(
      StartSessionRequestSchema.parse({ ...request, feedbackMode: 'deferred' })
        .feedbackMode,
    ).toBe('deferred');
  });

  it('[TC-03-01] requires exactly PLAN_QUESTIONS questions', () => {
    for (const count of [PLAN_QUESTIONS - 1, PLAN_QUESTIONS + 1]) {
      expect(
        StartSessionRequestSchema.safeParse({
          ...request,
          questions: questionsOf(count),
        }).success,
      ).toBe(false);
    }
  });

  it('[TC-03-01] applies topic and question bounds with trim', () => {
    expect(
      StartSessionRequestSchema.parse({ ...request, topic: '  Travel  ' })
        .topic,
    ).toBe('Travel');
    expect(
      StartSessionRequestSchema.safeParse({
        ...request,
        topic: 'a'.repeat(TOPIC_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      StartSessionRequestSchema.safeParse({
        ...request,
        questions: ['q'.repeat(QUESTION_MAX), ...request.questions.slice(1)],
      }).success,
    ).toBe(true);
    expect(
      StartSessionRequestSchema.safeParse({
        ...request,
        questions: [
          'q'.repeat(QUESTION_MAX + 1),
          ...request.questions.slice(1),
        ],
      }).success,
    ).toBe(false);
  });

  it('[TC-03-01] rejects an unknown topicSource and feedbackMode', () => {
    expect(
      StartSessionRequestSchema.safeParse({ ...request, topicSource: 'x' })
        .success,
    ).toBe(false);
    expect(
      StartSessionRequestSchema.safeParse({ ...request, feedbackMode: 'x' })
        .success,
    ).toBe(false);
  });
});

describe('session response schemas', () => {
  it('[TC-03-01] SessionSchema accepts active and finished sessions', () => {
    expect(SessionSchema.parse(session)).toEqual(session);
    const finished = {
      ...session,
      status: 'finished',
      endedAt: '2026-11-13T10:15:00.000Z',
    };
    expect(SessionSchema.parse(finished)).toEqual(finished);
  });

  it('[TC-03-01] SessionSchema rejects a bad id, status and date', () => {
    expect(SessionSchema.safeParse({ ...session, id: 'x' }).success).toBe(
      false,
    );
    expect(
      SessionSchema.safeParse({ ...session, status: 'paused' }).success,
    ).toBe(false);
    expect(
      SessionSchema.safeParse({ ...session, startedAt: 'yesterday' }).success,
    ).toBe(false);
    expect(
      SessionSchema.safeParse({ ...session, endedAt: undefined }).success,
    ).toBe(false);
  });

  it('[TC-03-01] SessionListSchema is a list of sessions', () => {
    expect(SessionListSchema.parse([session, session])).toHaveLength(2);
    expect(SessionListSchema.parse([])).toEqual([]);
    expect(SessionListSchema.safeParse([{ id }]).success).toBe(false);
  });

  it('[TC-03-01] UtteranceSchema validates seq and role', () => {
    expect(UtteranceSchema.parse(utterance)).toEqual(utterance);
    expect(UtteranceSchema.safeParse({ ...utterance, seq: 0 }).success).toBe(
      false,
    );
    expect(UtteranceSchema.safeParse({ ...utterance, seq: 1.5 }).success).toBe(
      false,
    );
    expect(
      UtteranceSchema.safeParse({ ...utterance, role: 'system' }).success,
    ).toBe(false);
  });

  it('[TC-03-01] SessionDetailsSchema extends Session with utterances', () => {
    const details = { ...session, utterances: [utterance], planRemaining: 4 };
    expect(SessionDetailsSchema.parse(details)).toEqual(details);
    expect(SessionDetailsSchema.safeParse(session).success).toBe(false);
  });

  it('[TC-05-03] SessionPageSchema wraps sessions with a nullable cursor', () => {
    expect(
      SessionPageSchema.parse({ items: [session], nextCursor: null }),
    ).toEqual({
      items: [session],
      nextCursor: null,
    });
    expect(
      SessionPageSchema.parse({ items: [], nextCursor: 'c' }).nextCursor,
    ).toBe('c');
    expect(SessionPageSchema.safeParse({ items: [session] }).success).toBe(
      false,
    );
  });
});
