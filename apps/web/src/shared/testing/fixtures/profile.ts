import type { Goal, LearnerModel, Profile } from '@gototalk/shared';

export const TEST_PROFILE: Profile = {
  level: 'B1',
  scenes: ['work_meetings', 'small_talk'],
  updatedAt: '2026-11-13T10:00:00.000Z',
};

export function testGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0001',
    title: 'Speak fluently',
    status: 'active',
    createdAt: '2026-11-13T10:00:00.000Z',
    ...overrides,
  };
}

export const TEST_LEARNER_MODEL: LearnerModel = {
  weakAreas: [
    {
      category: 'articles',
      frequency: 7,
      lastSeenAt: '2026-11-12T09:30:00.000Z',
    },
    { category: 'verb_tense', frequency: 3, lastSeenAt: null },
  ],
  vocabulary: { new: 12, partial: 5, passive: 3, active: 1 },
};

export const TOP_FIVE_LEARNER_MODEL: LearnerModel = {
  weakAreas: [
    { category: 'articles', frequency: 7, lastSeenAt: null },
    { category: 'prepositions', frequency: 5, lastSeenAt: null },
    { category: 'verb_tense', frequency: 3, lastSeenAt: null },
    { category: 'word_order', frequency: 2, lastSeenAt: null },
    { category: 'l1_calque', frequency: 1, lastSeenAt: null },
  ],
  vocabulary: { new: 12, partial: 5, passive: 3, active: 1 },
};

export const EMPTY_LEARNER_MODEL: LearnerModel = {
  weakAreas: [],
  vocabulary: { new: 0, partial: 0, passive: 0, active: 0 },
};
