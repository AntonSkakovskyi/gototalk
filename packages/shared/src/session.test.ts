import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_MODES,
  HISTORY_PAGE_SIZE_DEFAULT,
  HISTORY_PAGE_SIZE_MAX,
  HistoryQuerySchema,
  MAX_TOPIC_REROLLS,
  PLAN_QUESTIONS,
  PlanSchema,
  PlanSessionRequestSchema,
  QUESTION_MAX,
  RECENT_SESSIONS_LIMIT,
  SESSION_STATUSES,
  SessionDetailsSchema,
  SessionListSchema,
  SessionPageSchema,
  SessionPlanSchema,
  SessionSchema,
  StartSessionRequestSchema,
  TOPIC_MAX,
  TOPIC_SOURCES,
  TopicSchema,
  UTTERANCE_ROLES,
  UtteranceSchema,
} from './index.js';

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

describe('PlanSchema bounds', () => {
  const plan = { topic: 'Travel', questions: questionsOf(PLAN_QUESTIONS) };

  it('[TC-03-01] accepts a topic of TOPIC_MAX and a question of QUESTION_MAX', () => {
    const longest = {
      topic: 'a'.repeat(TOPIC_MAX),
      questions: ['q'.repeat(QUESTION_MAX), ...questionsOf(PLAN_QUESTIONS - 1)],
    };
    expect(PlanSchema.parse(longest)).toEqual(longest);
  });

  it('[TC-03-01] rejects a topic over TOPIC_MAX and a question over QUESTION_MAX', () => {
    expect(
      PlanSchema.safeParse({ ...plan, topic: 'a'.repeat(TOPIC_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      PlanSchema.safeParse({
        ...plan,
        questions: ['q'.repeat(QUESTION_MAX + 1), ...plan.questions.slice(1)],
      }).success,
    ).toBe(false);
  });

  it('[TC-03-01] trims topic and questions and rejects blank ones', () => {
    const parsed = PlanSchema.parse({
      topic: '  Travel  ',
      questions: plan.questions.map((q) => ` ${q} `),
    });
    expect(parsed).toEqual(plan);
    expect(PlanSchema.safeParse({ ...plan, topic: '  ' }).success).toBe(false);
    expect(
      PlanSchema.safeParse({
        ...plan,
        questions: ['  ', ...plan.questions.slice(1)],
      }).success,
    ).toBe(false);
  });

  it('[TC-03-01] requires exactly PLAN_QUESTIONS questions', () => {
    for (const count of [PLAN_QUESTIONS - 1, PLAN_QUESTIONS + 1]) {
      expect(
        PlanSchema.safeParse({ ...plan, questions: questionsOf(count) })
          .success,
      ).toBe(false);
    }
    expect(PlanSchema.safeParse(plan).success).toBe(true);
  });
});

describe('PlanSessionRequestSchema', () => {
  it('[TC-03-01] defaults previousTopics to an empty list', () => {
    expect(PlanSessionRequestSchema.parse({})).toEqual({ previousTopics: [] });
  });

  it('[TC-03-01] accepts MAX_TOPIC_REROLLS previous topics and rejects one more', () => {
    const topics = ['a', 'b', 'c', 'd'];
    expect(
      PlanSessionRequestSchema.safeParse({
        previousTopics: topics.slice(0, MAX_TOPIC_REROLLS),
      }).success,
    ).toBe(true);
    expect(
      PlanSessionRequestSchema.safeParse({
        previousTopics: topics.slice(0, MAX_TOPIC_REROLLS + 1),
      }).success,
    ).toBe(false);
  });

  it('[TC-03-01] trims customTopic and enforces TOPIC_MAX', () => {
    expect(
      PlanSessionRequestSchema.parse({ customTopic: '  My trip  ' })
        .customTopic,
    ).toBe('My trip');
    expect(
      PlanSessionRequestSchema.safeParse({
        customTopic: 'a'.repeat(TOPIC_MAX),
      }).success,
    ).toBe(true);
    expect(
      PlanSessionRequestSchema.safeParse({
        customTopic: 'a'.repeat(TOPIC_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      PlanSessionRequestSchema.safeParse({ customTopic: '   ' }).success,
    ).toBe(false);
  });

  it('[TC-03-01] applies TopicSchema to previousTopics items', () => {
    expect(
      PlanSessionRequestSchema.parse({ previousTopics: ['  a  '] })
        .previousTopics,
    ).toEqual(['a']);
    expect(
      PlanSessionRequestSchema.safeParse({
        previousTopics: ['a'.repeat(TOPIC_MAX + 1)],
      }).success,
    ).toBe(false);
  });
});

describe('SessionPlanSchema', () => {
  const plan = {
    topic: 'Travel',
    questions: questionsOf(PLAN_QUESTIONS),
    topicSource: 'suggested',
  };

  it('[TC-03-01] accepts a plan with a topic source', () => {
    expect(SessionPlanSchema.parse(plan)).toEqual(plan);
  });

  it('[TC-03-01] rejects an unknown or missing topic source and a wrong question count', () => {
    expect(
      SessionPlanSchema.safeParse({ ...plan, topicSource: 'random' }).success,
    ).toBe(false);
    expect(
      SessionPlanSchema.safeParse({
        topic: plan.topic,
        questions: plan.questions,
      }).success,
    ).toBe(false);
    expect(
      SessionPlanSchema.safeParse({
        ...plan,
        questions: questionsOf(PLAN_QUESTIONS + 1),
      }).success,
    ).toBe(false);
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

  it('[TC-05-03] HistoryQuerySchema defaults the limit and keeps the cursor', () => {
    expect(HistoryQuerySchema.parse({})).toEqual({
      limit: HISTORY_PAGE_SIZE_DEFAULT,
    });
    expect(HistoryQuerySchema.parse({ cursor: 'abc', limit: '5' })).toEqual({
      cursor: 'abc',
      limit: 5,
    });
    expect(
      HistoryQuerySchema.parse({ limit: String(HISTORY_PAGE_SIZE_MAX) }).limit,
    ).toBe(HISTORY_PAGE_SIZE_MAX);
  });

  it('[TC-05-03] HistoryQuerySchema rejects a bad limit or cursor', () => {
    const bad = [
      { limit: '0' },
      { limit: String(HISTORY_PAGE_SIZE_MAX + 1) },
      { limit: 'abc' },
      { limit: '' },
      { limit: '1.5' },
      { limit: '-1' },
      { limit: ['1', '2'] },
      { cursor: '' },
      { cursor: 'x'.repeat(201) },
      { cursor: ['a', 'b'] },
    ];
    for (const query of bad) {
      expect(
        HistoryQuerySchema.safeParse(query).success,
        JSON.stringify(query),
      ).toBe(false);
    }
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
