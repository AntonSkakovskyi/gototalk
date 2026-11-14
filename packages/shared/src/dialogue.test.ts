import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_STATUSES,
  ANSWER_TEXT_MAX,
  AnalysisStatusSchema,
  AnswerTextRequestSchema,
  MarkMistakeRequestSchema,
  MistakeViewSchema,
  SessionDetailsSchema,
  TurnResultSchema,
  UtteranceSchema,
} from './index.js';

const id = '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0001';

const mistakeView = {
  id,
  start: 0,
  end: 4,
  original: 'I go',
  suggestion: 'I went',
  category: 'verb_tense',
  explanationEn: 'Use the past simple.',
  translationUk: 'Використовуйте Past Simple.',
  isFalse: false,
};

const userUtterance = {
  id,
  seq: 2,
  role: 'user',
  text: 'I go there.',
  analysisStatus: 'done',
  mistakes: [mistakeView],
  better: [{ original: 'I go', better: 'I went' }],
};

const assistantUtterance = {
  id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0001',
  seq: 3,
  role: 'assistant',
  text: 'Why?',
  analysisStatus: 'skipped',
  mistakes: [],
  better: [],
};

describe('dialogue contracts', () => {
  it('[TC-04-01] AnswerTextRequestSchema accepts 1000 characters and rejects 1001', () => {
    expect(ANSWER_TEXT_MAX).toBe(1000);
    expect(
      AnswerTextRequestSchema.safeParse({ text: 'a'.repeat(1000) }).success,
    ).toBe(true);
    expect(
      AnswerTextRequestSchema.safeParse({ text: 'a'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('[TC-04-01] AnswerTextRequestSchema trims and rejects empty or whitespace text', () => {
    expect(AnswerTextRequestSchema.parse({ text: '  hello  ' })).toEqual({
      text: 'hello',
    });
    expect(AnswerTextRequestSchema.safeParse({ text: '' }).success).toBe(false);
    expect(AnswerTextRequestSchema.safeParse({ text: ' \n\t ' }).success).toBe(
      false,
    );
    expect(AnswerTextRequestSchema.safeParse({}).success).toBe(false);
  });

  it('[TC-04-01] analysis statuses match the database check', () => {
    expect(ANALYSIS_STATUSES).toEqual(['pending', 'done', 'failed', 'skipped']);
    expect(AnalysisStatusSchema.safeParse('running').success).toBe(false);
  });

  it('[TC-04-01] MistakeViewSchema validates the camelCase view', () => {
    expect(MistakeViewSchema.parse(mistakeView)).toEqual(mistakeView);
    expect(
      MistakeViewSchema.safeParse({ ...mistakeView, category: 'spelling' })
        .success,
    ).toBe(false);
    expect(
      MistakeViewSchema.safeParse({ ...mistakeView, id: 'x' }).success,
    ).toBe(false);
    expect(
      MistakeViewSchema.safeParse({ ...mistakeView, end: 0 }).success,
    ).toBe(false);
    expect(
      MistakeViewSchema.safeParse({ ...mistakeView, start: -1 }).success,
    ).toBe(false);
  });

  it('[TC-04-01] UtteranceSchema carries analysis status, mistakes and better phrasings', () => {
    expect(UtteranceSchema.parse(userUtterance)).toEqual(userUtterance);
    expect(UtteranceSchema.parse(assistantUtterance)).toEqual(
      assistantUtterance,
    );
    expect(
      UtteranceSchema.safeParse({ ...userUtterance, mistakes: undefined })
        .success,
    ).toBe(false);
    expect(
      UtteranceSchema.safeParse({ ...userUtterance, analysisStatus: 'x' })
        .success,
    ).toBe(false);
  });

  it('[TC-04-01] SessionDetailsSchema requires a non-negative integer planRemaining', () => {
    const details = {
      id,
      topic: 'T',
      topicSource: 'suggested',
      feedbackMode: 'immediate',
      status: 'active',
      startedAt: '2026-11-13T10:00:00.000Z',
      endedAt: null,
      utterances: [assistantUtterance],
      planRemaining: 4,
    };
    expect(SessionDetailsSchema.parse(details)).toEqual(details);
    expect(
      SessionDetailsSchema.safeParse({ ...details, planRemaining: 0 }).success,
    ).toBe(true);
    expect(
      SessionDetailsSchema.safeParse({ ...details, planRemaining: -1 }).success,
    ).toBe(false);
    expect(
      SessionDetailsSchema.safeParse({ ...details, planRemaining: 1.5 })
        .success,
    ).toBe(false);
    expect(
      SessionDetailsSchema.safeParse({ ...details, planRemaining: undefined })
        .success,
    ).toBe(false);
  });

  it('[TC-04-01] TurnResultSchema allows a null reply', () => {
    const value = {
      utterance: userUtterance,
      reply: assistantUtterance,
      planRemaining: 3,
    };
    expect(TurnResultSchema.parse(value)).toEqual(value);
    expect(TurnResultSchema.parse({ ...value, reply: null }).reply).toBeNull();
    expect(
      TurnResultSchema.safeParse({ utterance: userUtterance, planRemaining: 3 })
        .success,
    ).toBe(false);
  });

  it('[TC-04-01] MarkMistakeRequestSchema only accepts isFalse true', () => {
    expect(MarkMistakeRequestSchema.parse({ isFalse: true })).toEqual({
      isFalse: true,
    });
    expect(MarkMistakeRequestSchema.safeParse({ isFalse: false }).success).toBe(
      false,
    );
    expect(MarkMistakeRequestSchema.safeParse({}).success).toBe(false);
  });
});
