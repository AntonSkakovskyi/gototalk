import {
  CreateGoalRequestSchema,
  UpdateGoalRequestSchema,
  type Goal,
} from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import { emptyResponse, jsonResponse } from '@/shared/testing/http-responses';
import { testGoal } from '@/shared/testing/fixtures/profile';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { GoalsSection } from '@/features/profile/components/GoalsSection/GoalsSection';

export const text = uk.profile.goals;

export const FLUENT = testGoal({
  id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0001',
  title: 'Speak fluently',
});
export const MEETINGS = testGoal({
  id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0002',
  title: 'Lead meetings',
});
export const INTERVIEW = testGoal({
  id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0003',
  title: 'Pass an interview',
});
export const TRAVEL = testGoal({
  id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0004',
  title: 'Travel abroad',
  status: 'done',
});

export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
    template,
  );
}

export function counterText(active: number): string {
  return fill(text.counter, { active, max: 3 });
}

export function goalButton(label: keyof typeof text.actions, title: string) {
  return screen.getByRole('button', {
    name: fill(text.actions[label], { title }),
  });
}

export function addField() {
  return screen.getByLabelText(text.add.label);
}

export function addButton() {
  return screen.getByRole('button', { name: text.add.submit });
}

/** Stateful goals API: PATCH and DELETE routes exist for the initial goals only. */
export function stubGoals(
  initial: Goal[],
  overrides: Parameters<typeof mockApi>[0] = {},
) {
  let goals = [...initial];
  const routes: Parameters<typeof mockApi>[0] = {
    'GET /api/goals': () => jsonResponse(goals),
    'POST /api/goals': ({ body }) => {
      const { title } = CreateGoalRequestSchema.parse(body);
      const created = testGoal({ id: crypto.randomUUID(), title });
      goals = [...goals, created];
      return jsonResponse(created, 201);
    },
  };
  for (const { id } of initial) {
    routes[`PATCH /api/goals/${id}`] = ({ body }) => {
      const patch = UpdateGoalRequestSchema.parse(body);
      goals = goals.map((goal) =>
        goal.id === id ? { ...goal, ...patch } : goal,
      );
      return jsonResponse(goals.find((goal) => goal.id === id));
    };
    routes[`DELETE /api/goals/${id}`] = () => {
      goals = goals.filter((goal) => goal.id !== id);
      return emptyResponse();
    };
  }
  return mockApi({ ...routes, ...overrides });
}

export function renderGoals() {
  return renderWithProviders(<GoalsSection />);
}

export function listedTitles(): (string | null)[] {
  return screen
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent ?? null);
}

export function goalItem(title: string): HTMLElement {
  const item = screen
    .getAllByRole('listitem')
    .find((candidate) => within(candidate).queryByText(title) !== null);
  if (!item) {
    throw new Error(`No goal item titled "${title}"`);
  }
  return item;
}
