import {
  GoalTitleSchema,
  LevelSchema,
  MAX_ACTIVE_GOALS,
  MAX_SCENES,
  MAX_SCENE_LENGTH,
  GOAL_TITLE_MAX,
  SceneSchema,
  ScenesSchema,
} from '@gototalk/shared';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { ProfileErrorMessage } from '@/features/profile/lib/profile-errors';

// Each step name is also the form field it validates, so `trigger(step)` checks exactly that step.
export const ONBOARDING_STEPS = ['level', 'scenes', 'goals'] as const;

export const onboardingSchema = z.object({
  // The form holds null until a level is picked; the pipe turns it into a validation error.
  level: LevelSchema.nullable().pipe(LevelSchema),
  scenes: ScenesSchema,
  goals: z
    .array(z.object({ title: GoalTitleSchema }))
    .min(1)
    .max(MAX_ACTIVE_GOALS),
});

export type OnboardingFormValues = z.input<typeof onboardingSchema>;
export type OnboardingValues = z.output<typeof onboardingSchema>;

export type OnboardingForm = UseFormReturn<
  OnboardingFormValues,
  unknown,
  OnboardingValues
>;

export const ONBOARDING_DEFAULTS: OnboardingFormValues = {
  level: null,
  scenes: [],
  goals: [{ title: '' }],
};

export function toOnboardingInput({ level, scenes, goals }: OnboardingValues) {
  return { level, scenes, goals: goals.map(({ title }) => title) };
}

interface FieldIssue {
  type?: string;
}

const ERRORS = 'profile.onboarding.errors';

export function levelErrorMessage(
  error: FieldIssue | undefined,
): ProfileErrorMessage | null {
  return error ? { key: `${ERRORS}.levelRequired` } : null;
}

export function scenesErrorMessage(
  error: FieldIssue | undefined,
): ProfileErrorMessage | null {
  if (!error) {
    return null;
  }
  if (error.type === 'too_big') {
    return { key: `${ERRORS}.scenesTooMany`, values: { max: MAX_SCENES } };
  }
  return {
    key: `${ERRORS}.${error.type === 'custom' ? 'sceneDuplicate' : 'scenesRequired'}`,
  };
}

export function goalErrorMessage(
  error: FieldIssue | undefined,
): ProfileErrorMessage | null {
  if (!error) {
    return null;
  }
  return error.type === 'too_big'
    ? { key: `${ERRORS}.goalTooLong`, values: { max: GOAL_TITLE_MAX } }
    : { key: `${ERRORS}.goalRequired` };
}

type AddSceneResult = { scenes: string[] } | { error: ProfileErrorMessage };

export function addCustomScene(
  text: string,
  scenes: readonly string[],
): AddSceneResult {
  const parsed = SceneSchema.safeParse(text);
  if (!parsed.success) {
    return parsed.error.issues[0]?.code === 'too_big'
      ? {
          error: {
            key: `${ERRORS}.sceneTooLong`,
            values: { max: MAX_SCENE_LENGTH },
          },
        }
      : { error: { key: `${ERRORS}.sceneEmpty` } };
  }
  if (scenes.includes(parsed.data)) {
    return { error: { key: `${ERRORS}.sceneDuplicate` } };
  }
  if (scenes.length >= MAX_SCENES) {
    return {
      error: { key: `${ERRORS}.scenesTooMany`, values: { max: MAX_SCENES } },
    };
  }
  return { scenes: [...scenes, parsed.data] };
}
