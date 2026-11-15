import { describe, expect, it } from 'vitest';
import {
  MAX_TOPIC_REROLLS,
  PLAN_QUESTIONS,
  PlanSchema,
  PlanSessionRequestSchema,
  QUESTION_MAX,
  SessionPlanSchema,
  TOPIC_MAX,
} from '../index.js';

const questionsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => `Question ${i + 1}?`);

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
