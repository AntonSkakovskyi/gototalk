import { CreateGoalRequestSchema, type Goal } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_SESSIONS_ROUTE,
  TEST_PROFILE,
  errorResponse,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { OnboardingWizard } from './OnboardingWizard';

export const text = uk.profile.onboarding;
export const presets = uk.profile.scenes.presets;

export type User = ReturnType<typeof userEvent.setup>;

export function renderWizard() {
  const onCompleted = vi.fn();
  renderWithProviders(<OnboardingWizard onCompleted={onCompleted} />);
  return onCompleted;
}

export function progress(current: number): string {
  return text.progress
    .replace('{{current}}', String(current))
    .replace('{{total}}', '3');
}

export function goalFieldLabel(index: number): string {
  return text.goals.fieldLabel.replace('{{index}}', String(index));
}

export function removeGoalLabel(index: number): string {
  return text.goals.remove.replace('{{index}}', String(index));
}

export function withMax(message: string, max: number): string {
  return message.replace('{{max}}', String(max));
}

export function button(name: string) {
  return screen.getByRole('button', { name });
}

export function chip(name: string) {
  return screen.getByRole('checkbox', { name });
}

export function levelOption(level: string) {
  return screen.getByRole('radio', { name: new RegExp(`^${level}`) });
}

export function goalField(index: number) {
  return screen.getByLabelText(goalFieldLabel(index));
}

export function sceneInput() {
  return screen.getByLabelText(text.scenes.customLabel);
}

export async function chooseLevel(user: User, level: string) {
  await user.click(levelOption(level));
}

export async function addScene(user: User, scene: string) {
  await user.type(sceneInput(), scene);
  await user.click(button(text.scenes.add));
}

export async function openScenes(user: User) {
  await chooseLevel(user, 'B2');
  await user.click(button(text.actions.next));
}

export async function reachGoals(user: User) {
  await chooseLevel(user, 'B1');
  await user.click(button(text.actions.next));
  await user.click(chip(presets.work_meetings));
  await addScene(user, 'Travel for work');
  await user.click(button(text.actions.next));
}

export function stubGoalsApi(
  profileReply: () => Response | Promise<Response>,
  extraRoutes: Parameters<typeof mockApi>[0] = {},
) {
  const goals: Goal[] = [];
  return mockApi({
    'GET /api/goals': () => jsonResponse(goals),
    'POST /api/goals': ({ body }) => {
      const { title } = CreateGoalRequestSchema.parse(body);
      goals.push(testGoal({ id: crypto.randomUUID(), title }));
      return jsonResponse(goals.at(-1), 201);
    },
    'PUT /api/profile': profileReply,
    ...extraRoutes,
  });
}

export async function completeOnboarding(user: User) {
  await chooseLevel(user, 'B1');
  await user.click(button(text.actions.next));
  await user.click(chip(presets.travel));
  await user.click(button(text.actions.next));
  await user.type(goalField(1), 'Speak fluently');
  await user.click(button(text.actions.finish));
}

export function stubNewUserApi() {
  let saved = false;
  return stubGoalsApi(
    () => {
      saved = true;
      return jsonResponse(TEST_PROFILE);
    },
    {
      ...EMPTY_SESSIONS_ROUTE,
      'GET /api/profile': () =>
        saved
          ? jsonResponse(TEST_PROFILE)
          : errorResponse(404, 'PROFILE_NOT_FOUND'),
    },
  );
}
