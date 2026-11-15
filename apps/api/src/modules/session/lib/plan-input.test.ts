import { describe, expect, it } from 'vitest';
import type { Goal, Profile } from '@gototalk/shared';
import type { WeakArea } from '../../learner-model/learner-model.types.js';
import { buildPlanInput } from './plan-input.js';

const PROFILE: Profile = {
  level: 'B1',
  scenes: ['work_meetings', 'Cooking class'],
  updatedAt: '2026-11-13T10:00:00.000Z',
};

function goal(title: string): Goal {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title,
    status: 'active',
    createdAt: '2026-11-13T10:00:00.000Z',
  };
}

function weakArea(category: WeakArea['category'], frequency: number): WeakArea {
  return { category, frequency, lastSeenAt: null };
}

function build(overrides: Partial<Parameters<typeof buildPlanInput>[0]> = {}) {
  return buildPlanInput({
    profile: PROFILE,
    goals: [goal('Speak at meetings'), goal('Pass an interview')],
    weakAreas: [weakArea('verb_tense', 5), weakArea('articles', 2)],
    request: { previousTopics: ['Weekend plans'] },
    ...overrides,
  });
}

describe('buildPlanInput', () => {
  it('[TC-03-01] maps level, scenes, goal titles, patterns and previous topics', () => {
    expect(build()).toEqual({
      level: 'B1',
      scenes: ['work_meetings', 'Cooking class'],
      goals: ['Speak at meetings', 'Pass an interview'],
      patterns: ['verb_tense', 'articles'],
      previousTopics: ['Weekend plans'],
    });
  });

  it('[TC-03-01] keeps at most 3 patterns in the given most-frequent-first order', () => {
    const input = build({
      weakAreas: [
        weakArea('prepositions', 9),
        weakArea('verb_tense', 7),
        weakArea('articles', 5),
        weakArea('word_order', 3),
      ],
    });

    expect(input.patterns).toEqual(['prepositions', 'verb_tense', 'articles']);
  });

  it('[TC-03-01] keeps the goal order as given', () => {
    const input = build({ goals: [goal('Second'), goal('First')] });

    expect(input.goals).toEqual(['Second', 'First']);
  });

  it('[TC-03-01] yields empty goals and patterns when there are none', () => {
    const input = build({ goals: [], weakAreas: [] });

    expect(input.goals).toEqual([]);
    expect(input.patterns).toEqual([]);
  });

  it('[TC-03-01] includes the custom topic when it is present', () => {
    const input = build({
      request: { previousTopics: [], customTopic: 'My cat' },
    });

    expect(input.customTopic).toBe('My cat');
  });

  it('[TC-03-01] omits the customTopic key when it is absent', () => {
    expect('customTopic' in build()).toBe(false);
  });

  it('[TC-03-02] ignores previous topics when a custom topic is set', () => {
    const input = build({
      request: { previousTopics: ['A', 'B'], customTopic: 'My cat' },
    });

    expect(input.previousTopics).toEqual([]);
  });

  it('[TC-03-01] passes previous topics through unchanged', () => {
    const input = build({
      request: { previousTopics: ['A', 'B', 'C'] },
    });

    expect(input.previousTopics).toEqual(['A', 'B', 'C']);
  });
});
