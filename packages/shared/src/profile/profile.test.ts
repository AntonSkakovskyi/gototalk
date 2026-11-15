import { describe, expect, it } from 'vitest';
import {
  CreateGoalRequestSchema,
  GoalSchema,
  GoalTitleSchema,
  isScenePreset,
  LearnerModelSchema,
  LevelSchema,
  GOAL_TITLE_MAX,
  MAX_ACTIVE_GOALS,
  MAX_SCENE_LENGTH,
  MAX_SCENES,
  ProfileSchema,
  SCENE_PRESETS,
  SceneSchema,
  ScenesSchema,
  UpdateGoalRequestSchema,
  UpdateProfileRequestSchema,
} from '../index.js';

describe('profile schemas', () => {
  it('[TC-02-01] LevelSchema rejects a level below A2', () => {
    expect(LevelSchema.safeParse('A1').success).toBe(false);
    expect(LevelSchema.safeParse('B1').success).toBe(true);
  });

  it('[TC-02-01] ScenesSchema rejects an empty list', () => {
    expect(ScenesSchema.safeParse([]).success).toBe(false);
  });

  it('[TC-02-01] SceneSchema rejects whitespace-only text', () => {
    expect(SceneSchema.safeParse('   ').success).toBe(false);
  });

  it('[TC-02-01] SceneSchema trims text and limits it to 60 characters', () => {
    expect(SceneSchema.parse('  ordering coffee ')).toBe('ordering coffee');
    expect(SceneSchema.safeParse('a'.repeat(61)).success).toBe(false);
  });

  it('[TC-02-01] ScenesSchema rejects duplicates', () => {
    expect(ScenesSchema.safeParse(['travel', 'travel']).success).toBe(false);
  });

  it('[TC-02-01] ScenesSchema rejects more than 6 scenes', () => {
    const scenes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(ScenesSchema.safeParse(scenes).success).toBe(false);
  });

  it('[TC-02-01] ScenesSchema accepts preset codes and custom text', () => {
    expect(
      ScenesSchema.safeParse(['work_meetings', 'ordering coffee']).success,
    ).toBe(true);
  });

  it('[TC-02-01] isScenePreset tells preset codes from custom text', () => {
    for (const preset of SCENE_PRESETS) {
      expect(isScenePreset(preset)).toBe(true);
    }
    expect(isScenePreset('ordering coffee')).toBe(false);
  });

  it('[TC-02-01] UpdateProfileRequestSchema requires level and scenes', () => {
    expect(
      UpdateProfileRequestSchema.safeParse({ level: 'B1', scenes: ['travel'] })
        .success,
    ).toBe(true);
    expect(UpdateProfileRequestSchema.safeParse({ level: 'B1' }).success).toBe(
      false,
    );
  });
});

describe('profile and goal limits', () => {
  it('[TC-02-01] the limits are 3 active goals, 6 scenes of 60 characters and 200-character titles', () => {
    expect([
      MAX_ACTIVE_GOALS,
      MAX_SCENES,
      MAX_SCENE_LENGTH,
      GOAL_TITLE_MAX,
    ]).toEqual([3, 6, 60, 200]);
  });

  it('[TC-02-01] the limits are enforced at the boundary', () => {
    expect(SceneSchema.safeParse('a'.repeat(MAX_SCENE_LENGTH)).success).toBe(
      true,
    );
    expect(
      SceneSchema.safeParse('a'.repeat(MAX_SCENE_LENGTH + 1)).success,
    ).toBe(false);
    const scenes = (count: number) =>
      Array.from({ length: count }, (_unused, index) => `scene ${index}`);
    expect(ScenesSchema.safeParse(scenes(MAX_SCENES)).success).toBe(true);
    expect(ScenesSchema.safeParse(scenes(MAX_SCENES + 1)).success).toBe(false);
    expect(GoalTitleSchema.safeParse('a'.repeat(GOAL_TITLE_MAX)).success).toBe(
      true,
    );
    expect(
      GoalTitleSchema.safeParse('a'.repeat(GOAL_TITLE_MAX + 1)).success,
    ).toBe(false);
  });
});

describe('goal schemas', () => {
  it('[TC-02-01] UpdateGoalRequestSchema rejects an empty object', () => {
    expect(UpdateGoalRequestSchema.safeParse({}).success).toBe(false);
  });

  it('[TC-02-01] UpdateGoalRequestSchema accepts a title or a status alone', () => {
    expect(
      UpdateGoalRequestSchema.safeParse({ title: 'Pass the interview' })
        .success,
    ).toBe(true);
    expect(UpdateGoalRequestSchema.safeParse({ status: 'done' }).success).toBe(
      true,
    );
  });

  it('[TC-02-01] UpdateGoalRequestSchema rejects an unknown status', () => {
    expect(
      UpdateGoalRequestSchema.safeParse({ status: 'archived' }).success,
    ).toBe(false);
  });

  it('[TC-02-01] goal title is trimmed and limited to 200 characters', () => {
    expect(GoalTitleSchema.parse('  Speak at a meeting ')).toBe(
      'Speak at a meeting',
    );
    expect(GoalTitleSchema.safeParse('a'.repeat(201)).success).toBe(false);
    expect(CreateGoalRequestSchema.safeParse({ title: '   ' }).success).toBe(
      false,
    );
  });
});

describe('profile and goal response schemas', () => {
  const goal = {
    id: '0b1d3f0e-6f55-4a53-9c43-3a6a6a1c2d10',
    title: 'Pass the interview',
    status: 'active',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  it('[TC-02-01] GoalSchema accepts a valid goal and rejects a bad id, status or date', () => {
    expect(GoalSchema.parse(goal)).toEqual(goal);
    expect(GoalSchema.safeParse({ ...goal, id: 'x' }).success).toBe(false);
    expect(GoalSchema.safeParse({ ...goal, status: 'archived' }).success).toBe(
      false,
    );
    expect(GoalSchema.safeParse({ ...goal, createdAt: 'today' }).success).toBe(
      false,
    );
  });

  it('[TC-02-01] ProfileSchema accepts a valid profile and rejects an invalid level, scenes or date', () => {
    const profile = {
      level: 'B1',
      scenes: ['travel'],
      updatedAt: '2026-11-01T10:00:00.000Z',
    };
    expect(ProfileSchema.parse(profile)).toEqual(profile);
    expect(ProfileSchema.safeParse({ ...profile, level: 'A1' }).success).toBe(
      false,
    );
    expect(ProfileSchema.safeParse({ ...profile, scenes: [] }).success).toBe(
      false,
    );
    expect(
      ProfileSchema.safeParse({ ...profile, updatedAt: 'now' }).success,
    ).toBe(false);
  });
});

describe('learner model schema', () => {
  it('[TC-02-01] LearnerModelSchema accepts a valid payload', () => {
    const payload = {
      weakAreas: [
        {
          category: 'articles',
          frequency: 4,
          lastSeenAt: '2026-11-01T10:00:00.000Z',
        },
        { category: 'word_order', frequency: 1, lastSeenAt: null },
      ],
      vocabulary: { new: 3, partial: 2, passive: 1, active: 0 },
    };
    expect(LearnerModelSchema.safeParse(payload).success).toBe(true);
  });

  it('[TC-02-01] LearnerModelSchema.vocabulary rejects an unknown state key', () => {
    expect(
      LearnerModelSchema.safeParse({
        weakAreas: [],
        vocabulary: { new: 0, partial: 0, passive: 0, active: 0, known: 1 },
      }).success,
    ).toBe(false);
  });

  it('[TC-02-01] LearnerModelSchema rejects a negative count and an unknown category', () => {
    const vocabulary = { new: 0, partial: 0, passive: 0, active: 0 };
    expect(
      LearnerModelSchema.safeParse({
        weakAreas: [],
        vocabulary: { ...vocabulary, new: -1 },
      }).success,
    ).toBe(false);
    expect(
      LearnerModelSchema.safeParse({
        weakAreas: [{ category: 'nope', frequency: 1, lastSeenAt: null }],
        vocabulary,
      }).success,
    ).toBe(false);
  });
});
