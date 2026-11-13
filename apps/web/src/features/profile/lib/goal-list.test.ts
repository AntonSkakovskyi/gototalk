import { testGoal } from '@/shared/testing/test-fixtures';
import { countActiveGoals, sortActiveFirst } from './goal-list';

const FIRST_DONE = testGoal({ id: 'a', title: 'first done', status: 'done' });
const FIRST_ACTIVE = testGoal({ id: 'b', title: 'first active' });
const SECOND_DONE = testGoal({ id: 'c', title: 'second done', status: 'done' });
const SECOND_ACTIVE = testGoal({ id: 'd', title: 'second active' });

describe('goal list helpers', () => {
  it('[TC-02-03] puts active goals first and keeps the server order within each group', () => {
    const sorted = sortActiveFirst([
      FIRST_DONE,
      FIRST_ACTIVE,
      SECOND_DONE,
      SECOND_ACTIVE,
    ]);

    expect(sorted.map(({ id }) => id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('[TC-02-03] counts only active goals', () => {
    expect(countActiveGoals([FIRST_DONE, FIRST_ACTIVE, SECOND_ACTIVE])).toBe(2);
    expect(countActiveGoals([])).toBe(0);
  });
});
