import { zodResolver } from '@hookform/resolvers/zod';
import {
  GOAL_TITLE_MAX,
  MAX_SCENES,
  MAX_SCENE_LENGTH,
  SCENE_PRESETS,
} from '@gototalk/shared';
import {
  addCustomScene,
  goalErrorMessage,
  levelErrorMessage,
  onboardingSchema,
  scenesErrorMessage,
  toOnboardingInput,
  type OnboardingFormValues,
} from './onboarding-form';

const VALID: OnboardingFormValues = {
  level: 'B1',
  scenes: ['work_meetings'],
  goals: [{ title: '  Speak fluently ' }],
};

describe('onboardingSchema', () => {
  it('[TC-02-04] accepts valid values and trims goal titles', () => {
    const parsed = onboardingSchema.parse(VALID);

    expect(parsed.goals).toEqual([{ title: 'Speak fluently' }]);
  });

  it('[TC-02-04] rejects a missing level, no scenes, blank and surplus goals', () => {
    const paths = (value: unknown) =>
      onboardingSchema
        .safeParse(value)
        .error?.issues.map(({ path }) => path.join('.'));

    expect(paths({ ...VALID, level: null })).toEqual(['level']);
    expect(paths({ ...VALID, scenes: [] })).toEqual(['scenes']);
    expect(paths({ ...VALID, goals: [{ title: '   ' }] })).toEqual([
      'goals.0.title',
    ]);
    expect(paths({ ...VALID, goals: [] })).toEqual(['goals']);
    expect(
      paths({
        ...VALID,
        goals: Array.from({ length: 4 }, () => ({ title: 'a' })),
      }),
    ).toEqual(['goals']);
  });
});

describe('toOnboardingInput', () => {
  it('[TC-02-04] flattens goal rows into titles', () => {
    const input = toOnboardingInput(onboardingSchema.parse(VALID));

    expect(input).toEqual({
      level: 'B1',
      scenes: ['work_meetings'],
      goals: ['Speak fluently'],
    });
  });
});

describe('error messages', () => {
  it('[TC-02-04] maps field errors to i18n keys instead of Zod messages', () => {
    expect(levelErrorMessage(undefined)).toBeNull();
    expect(levelErrorMessage({ type: 'invalid_value' })).toEqual({
      key: 'profile.onboarding.errors.levelRequired',
    });
    expect(scenesErrorMessage({ type: 'too_small' })).toEqual({
      key: 'profile.onboarding.errors.scenesRequired',
    });
    expect(scenesErrorMessage({ type: 'too_big' })).toEqual({
      key: 'profile.onboarding.errors.scenesTooMany',
      values: { max: MAX_SCENES },
    });
    expect(scenesErrorMessage({ type: 'custom' })).toEqual({
      key: 'profile.onboarding.errors.sceneDuplicate',
    });
    expect(goalErrorMessage({ type: 'too_small' })?.key).toBe(
      'profile.onboarding.errors.goalRequired',
    );
    expect(goalErrorMessage({ type: 'too_big' })?.key).toBe(
      'profile.onboarding.errors.goalTooLong',
    );
  });
});

describe('resolver errors', () => {
  async function resolveErrors(values: Partial<OnboardingFormValues>) {
    const { errors } = await zodResolver(onboardingSchema)(
      { ...VALID, ...values },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    return errors;
  }

  it('[TC-02-04] maps the real resolver errors to scene messages', async () => {
    const tooMany = Array.from({ length: MAX_SCENES + 1 }, (_, i) => `s${i}`);

    expect(
      scenesErrorMessage((await resolveErrors({ scenes: [] })).scenes),
    ).toEqual({
      key: 'profile.onboarding.errors.scenesRequired',
    });
    expect(
      scenesErrorMessage((await resolveErrors({ scenes: tooMany })).scenes),
    ).toEqual({
      key: 'profile.onboarding.errors.scenesTooMany',
      values: { max: MAX_SCENES },
    });
    expect(
      scenesErrorMessage((await resolveErrors({ scenes: ['a', 'a'] })).scenes),
    ).toEqual({ key: 'profile.onboarding.errors.sceneDuplicate' });
  });

  it('[TC-02-04] maps the real resolver errors to goal messages', async () => {
    const goalError = async (title: string) =>
      goalErrorMessage(
        (await resolveErrors({ goals: [{ title }] })).goals?.[0]?.title,
      );

    expect(await goalError('   ')).toEqual({
      key: 'profile.onboarding.errors.goalRequired',
    });
    expect(await goalError('x'.repeat(GOAL_TITLE_MAX + 1))).toEqual({
      key: 'profile.onboarding.errors.goalTooLong',
      values: { max: GOAL_TITLE_MAX },
    });
  });

  it('[TC-02-04] maps a missing level to its message', async () => {
    expect(
      levelErrorMessage((await resolveErrors({ level: null })).level),
    ).toEqual({ key: 'profile.onboarding.errors.levelRequired' });
  });
});

describe('addCustomScene', () => {
  it('[TC-02-04] appends the trimmed text', () => {
    expect(addCustomScene('  Travel for work ', ['travel'])).toEqual({
      scenes: ['travel', 'Travel for work'],
    });
  });

  it('[TC-02-04] rejects empty, too long, duplicate and surplus scenes', () => {
    expect(addCustomScene('   ', [])).toEqual({
      error: { key: 'profile.onboarding.errors.sceneEmpty' },
    });
    expect(addCustomScene('x'.repeat(MAX_SCENE_LENGTH + 1), [])).toEqual({
      error: {
        key: 'profile.onboarding.errors.sceneTooLong',
        values: { max: MAX_SCENE_LENGTH },
      },
    });
    expect(addCustomScene('travel', ['travel'])).toHaveProperty('error');
    const full = [...SCENE_PRESETS, 'Own'];
    expect(addCustomScene('One more', full)).toEqual({
      error: {
        key: 'profile.onboarding.errors.scenesTooMany',
        values: { max: MAX_SCENES },
      },
    });
  });
});
