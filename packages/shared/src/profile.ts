import { z } from 'zod';
import { MistakeCategoryCodeSchema } from './mistake-categories.js';

export const LEVELS = ['A2', 'B1', 'B2', 'C1'] as const;

export const LevelSchema = z.enum(LEVELS);

export const SCENE_PRESETS = [
  'work_meetings',
  'small_talk',
  'interviews',
  'daily_services',
  'travel',
] as const;

const scenePresetCodes: readonly string[] = SCENE_PRESETS;

export type ScenePreset = (typeof SCENE_PRESETS)[number];

export function isScenePreset(value: string): value is ScenePreset {
  return scenePresetCodes.includes(value);
}

export const MAX_SCENES = 6;

export const MAX_SCENE_LENGTH = 60;

export const GOAL_TITLE_MAX = 200;

export const SceneSchema = z.string().trim().min(1).max(MAX_SCENE_LENGTH);

export const ScenesSchema = z
  .array(SceneSchema)
  .min(1)
  .max(MAX_SCENES)
  .refine((scenes) => new Set(scenes).size === scenes.length);

export const GOAL_STATUSES = ['active', 'done'] as const;

export const GoalStatusSchema = z.enum(GOAL_STATUSES);

export const MAX_ACTIVE_GOALS = 3;

export const GoalTitleSchema = z.string().trim().min(1).max(GOAL_TITLE_MAX);

export const ProfileSchema = z.object({
  level: LevelSchema,
  scenes: ScenesSchema,
  updatedAt: z.iso.datetime(),
});

export const UpdateProfileRequestSchema = z.object({
  level: LevelSchema,
  scenes: ScenesSchema,
});

export const GoalSchema = z.object({
  id: z.uuid(),
  title: GoalTitleSchema,
  status: GoalStatusSchema,
  createdAt: z.iso.datetime(),
});

export const GoalListSchema = z.array(GoalSchema);

export const CreateGoalRequestSchema = z.object({
  title: GoalTitleSchema,
});

export const UpdateGoalRequestSchema = z
  .object({
    title: GoalTitleSchema.optional(),
    status: GoalStatusSchema.optional(),
  })
  .refine((body) => body.title !== undefined || body.status !== undefined);

export const WORD_STATES = ['new', 'partial', 'passive', 'active'] as const;

export const WordStateSchema = z.enum(WORD_STATES);

export const LearnerModelSchema = z.object({
  weakAreas: z.array(
    z.object({
      category: MistakeCategoryCodeSchema,
      frequency: z.int().min(0),
      lastSeenAt: z.iso.datetime().nullable(),
    }),
  ),
  vocabulary: z.record(WordStateSchema, z.int().min(0)),
});

export type Level = z.infer<typeof LevelSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type GoalStatus = z.infer<typeof GoalStatusSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type CreateGoalRequest = z.infer<typeof CreateGoalRequestSchema>;
export type UpdateGoalRequest = z.infer<typeof UpdateGoalRequestSchema>;
export type WordState = z.infer<typeof WordStateSchema>;
export type LearnerModel = z.infer<typeof LearnerModelSchema>;
