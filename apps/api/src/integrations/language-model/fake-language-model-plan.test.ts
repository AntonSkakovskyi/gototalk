import {
  PlanSchema,
  QUESTION_MAX,
  SCENE_PRESETS,
  TOPIC_MAX,
} from '@gototalk/shared';
import type { MistakeCategoryCode } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from './fake-language-model.js';
import type { PlanSessionInput } from './language-model.port.js';
import { renderSessionPlanPrompt } from './session-plan-prompt.js';

vi.mock('./session-plan-prompt.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./session-plan-prompt.js')>();
  return { renderSessionPlanPrompt: vi.fn(actual.renderSessionPlanPrompt) };
});

const llm = new FakeLanguageModel();

const baseInput: PlanSessionInput = {
  level: 'B1',
  scenes: ['work_meetings'],
  goals: [],
  patterns: [],
  previousTopics: [],
};

async function plan(overrides: Partial<PlanSessionInput> = {}) {
  return PlanSchema.parse(
    await llm.planSession({ ...baseInput, ...overrides }),
  );
}

const FIRST_TOPICS = {
  work_meetings: 'My last project at work',
  small_talk: 'Weekend plans',
  interviews: 'Why I want this job',
  daily_services: 'At the doctor',
  travel: 'My last trip',
} as const;

describe('FakeLanguageModel.planSession', () => {
  it('[TC-03-01] gives an identical plan for the same input', async () => {
    const input: PlanSessionInput = { ...baseInput, patterns: ['articles'] };

    expect(await llm.planSession(input)).toEqual(await llm.planSession(input));
  });

  it.each(SCENE_PRESETS)(
    '[TC-03-01] scene %s starts with the first topic of its bank',
    async (scene) => {
      const { topic } = await plan({ scenes: [scene] });

      expect(topic).toBe(FIRST_TOPICS[scene]);
    },
  );

  it('[TC-03-01] previousTopics of length 1..4 pick topics 2..5 and length 5 wraps to topic 1', async () => {
    const topics: string[] = [];
    for (let length = 0; length <= 5; length++) {
      const previousTopics = Array.from({ length }, (_, i) => `Topic ${i}`);
      topics.push((await plan({ previousTopics })).topic);
    }

    expect(topics).toEqual([
      'My last project at work',
      'A difficult meeting',
      'Planning a week',
      'Working with a team',
      'A skill I want to learn',
      'My last project at work',
    ]);
  });

  it('[TC-03-01] a custom scene falls back to the first preset in scenes', async () => {
    const result = await plan({
      scenes: ['Ordering coffee', 'travel', 'interviews'],
    });

    expect(result.topic).toBe('My last trip');
  });

  it('[TC-03-01] a profile without presets falls back to small_talk', async () => {
    expect((await plan({ scenes: ['Ordering coffee'] })).topic).toBe(
      'Weekend plans',
    );
    expect((await plan({ scenes: [] })).topic).toBe('Weekend plans');
  });

  it('[TC-03-01] questions differ per topic and keep the final generalising question', async () => {
    const first = await plan({ scenes: ['travel'] });
    const second = await plan({ scenes: ['travel'], previousTopics: ['x'] });

    expect(first.questions[0]).not.toBe(second.questions[0]);
    expect(first.questions[4]).toBe('What would you do differently next time?');
    expect(first.questions[1]).toContain(first.topic);
  });

  it('[TC-03-01] a custom topic keeps the entered text and uses the custom templates', async () => {
    const result = await plan({ customTopic: '  My cat Murka ' });

    expect(result.topic).toBe('My cat Murka');
    expect(result.questions).toEqual([
      'What is the first thing that comes to mind when you think about "My cat Murka"?',
      'Why did you choose to talk about "My cat Murka"?',
      'Tell me about your experience with "My cat Murka".',
      'What do you find most difficult about "My cat Murka"?',
      'How do you see "My cat Murka" in the future?',
    ]);
  });

  it('[TC-03-01] a custom topic ignores previousTopics', async () => {
    const withHistory = await plan({
      customTopic: 'My cat',
      previousTopics: ['a', 'b', 'c'],
    });

    expect(withHistory).toEqual(await plan({ customTopic: 'My cat' }));
  });

  it('[TC-03-01] verb_tense as the first pattern replaces question 1', async () => {
    const result = await plan({ patterns: ['verb_tense', 'articles'] });

    expect(result.questions[0]).toBe('Tell me what you did yesterday at work.');
    expect(result.questions.slice(1)).toEqual(
      (await plan()).questions.slice(1),
    );
  });

  it.each<[MistakeCategoryCode, string]>([
    ['articles', 'Describe your office or your room in detail.'],
    ['prepositions', 'When and where do you usually meet your friends?'],
    ['subject_verb_agreement', 'What does your best friend do every day?'],
    ['question_form', 'Ask me three questions about my job.'],
    ['other', 'Tell me about a typical day in your life.'],
    ['word_order', 'Tell me about a typical day in your life.'],
  ])(
    '[TC-03-01] pattern %s provokes the table question',
    async (pattern, question) => {
      expect((await plan({ patterns: [pattern] })).questions[0]).toBe(question);
    },
  );

  it('[TC-03-01] a pattern also replaces question 1 of a custom topic', async () => {
    const result = await plan({
      customTopic: 'My cat',
      patterns: ['articles'],
    });

    expect(result.questions[0]).toBe(
      'Describe your office or your room in detail.',
    );
    expect(result.questions[1]).toBe(
      'Why did you choose to talk about "My cat"?',
    );
  });

  it('[TC-03-01] goals and level do not change the plan', async () => {
    const withGoals = await plan({
      level: 'C1',
      goals: ['Speak confidently at stand-ups', 'Pass an interview'],
    });

    expect(withGoals).toEqual(await plan());
  });

  it('[TC-03-01] every plan has 5 non-empty questions within the bounds', async () => {
    const customTopics = ['x'.repeat(TOPIC_MAX), undefined];
    const patternSets: MistakeCategoryCode[][] = [[], ['verb_tense']];
    for (const scene of SCENE_PRESETS) {
      for (let length = 0; length <= 5; length++) {
        for (const customTopic of customTopics) {
          for (const patterns of patternSets) {
            const result = await plan({
              scenes: [scene],
              previousTopics: Array.from({ length }, () => 'x'),
              customTopic,
              patterns,
            });

            expect(result.topic.length).toBeLessThanOrEqual(TOPIC_MAX);
            expect(result.questions).toHaveLength(5);
            for (const question of result.questions) {
              expect(question.length).toBeGreaterThan(0);
              expect(question.length).toBeLessThanOrEqual(QUESTION_MAX);
            }
          }
        }
      }
    }
  });

  it('[TC-03-04] renders the session plan prompt before answering', async () => {
    vi.mocked(renderSessionPlanPrompt).mockClear();

    await llm.planSession(baseInput);

    expect(renderSessionPlanPrompt).toHaveBeenCalledWith(baseInput);
  });

  it('[TC-03-04] a broken prompt makes planSession reject', async () => {
    vi.mocked(renderSessionPlanPrompt).mockImplementationOnce(() => {
      throw new Error('Prompt "session-plan.v1" not found');
    });

    await expect(llm.planSession(baseInput)).rejects.toThrow(/not found/);
  });
});
