import type { Goal } from '@gototalk/shared';

export function countActiveGoals(goals: readonly Goal[]): number {
  return goals.filter(({ status }) => status === 'active').length;
}

export function sortActiveFirst(goals: readonly Goal[]): Goal[] {
  return [
    ...goals.filter(({ status }) => status === 'active'),
    ...goals.filter(({ status }) => status !== 'active'),
  ];
}
