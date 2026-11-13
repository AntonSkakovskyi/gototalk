import { ERROR_CODES, GOAL_TITLE_MAX } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import {
  errorResponse,
  jsonResponse,
  testGoal,
} from '@/shared/testing/test-fixtures';
import {
  FLUENT,
  INTERVIEW,
  MEETINGS,
  TRAVEL,
  addButton,
  addField,
  counterText,
  fill,
  renderGoals,
  stubGoals,
  text,
} from './goals-test-helpers';

describe('GoalsSection add goal', () => {
  it('[TC-02-03] creates a trimmed goal, clears the field and lists the goal', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT]);
    renderGoals();
    await screen.findByText(FLUENT.title);

    await user.type(addField(), '  Pass interviews ');
    await user.click(addButton());

    expect(await screen.findByText('Pass interviews')).toBeInTheDocument();
    expect(screen.getByText(counterText(2))).toBeInTheDocument();
    expect(addField()).toHaveValue('');
    const post = requests.find(({ method }) => method === 'POST');
    expect(post?.body).toEqual({ title: 'Pass interviews' });
  });

  it('[TC-02-04] adds a goal with Enter', async () => {
    const user = userEvent.setup();
    stubGoals([]);
    renderGoals();
    await screen.findByText(text.empty);

    await user.type(addField(), 'Pass interviews{Enter}');

    expect(await screen.findByText('Pass interviews')).toBeInTheDocument();
  });

  it('[TC-02-04] blocks an empty title with an announced message and sends nothing', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([]);
    renderGoals();
    await screen.findByText(text.empty);

    await user.click(addButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.profile.onboarding.errors.goalRequired,
    );
    expect(addField()).toBeInvalid();
    expect(requests.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('[TC-02-04] blocks a title longer than the limit', async () => {
    const user = userEvent.setup();
    stubGoals([]);
    renderGoals();
    await screen.findByText(text.empty);
    await user.click(addField());
    await user.paste('x'.repeat(GOAL_TITLE_MAX + 1));

    await user.click(addButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      fill(uk.profile.onboarding.errors.goalTooLong, { max: GOAL_TITLE_MAX }),
    );
  });

  it('[TC-02-03] disables adding and explains why when the active limit is reached', async () => {
    stubGoals([FLUENT, MEETINGS, INTERVIEW, TRAVEL]);
    renderGoals();
    await screen.findByText(FLUENT.title);

    expect(addField()).toBeDisabled();
    expect(addButton()).toBeDisabled();
    expect(addField()).toHaveAccessibleDescription(
      fill(text.add.limitHint, { max: 3 }),
    );
  });

  it('[TC-02-03] shows the server limit message when the list was stale', async () => {
    const user = userEvent.setup();
    stubGoals([FLUENT], {
      'POST /api/goals': errorResponse(409, ERROR_CODES.ACTIVE_GOALS_LIMIT),
    });
    renderGoals();
    await screen.findByText(FLUENT.title);

    await user.type(addField(), 'One more');
    await user.click(addButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      fill(text.errors.limit, { max: 3 }),
    );
    await waitFor(() => expect(addButton()).toBeEnabled());
    expect(addField()).toHaveValue('One more');
  });

  it('[TC-02-03] clears the error message after a successful action', async () => {
    const user = userEvent.setup();
    let failing = true;
    stubGoals([FLUENT], {
      'POST /api/goals': () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(
              testGoal({ id: INTERVIEW.id, title: 'One more' }),
              201,
            ),
    });
    renderGoals();
    await screen.findByText(FLUENT.title);
    await user.type(addField(), 'One more');
    await user.click(addButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    failing = false;
    await user.click(addButton());

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
});
