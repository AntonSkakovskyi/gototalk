import { GOAL_TITLE_MAX, MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { TEST_PROFILE } from '@/shared/testing/fixtures/profile';
import { jsonResponse } from '@/shared/testing/http-responses';
import {
  button,
  chip,
  goalField,
  levelOption,
  reachGoals,
  removeGoalLabel,
  renderWizard,
  stubGoalsApi,
  progress,
  text,
  withMax,
} from './wizard-test-helpers';

describe('OnboardingWizard goals step', () => {
  it('[TC-02-03] starts with one goal field and offers up to the active limit', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);

    expect(screen.getByText(progress(3))).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(goalField(1)).toHaveAttribute('placeholder', text.goals.placeholder);

    await user.click(button(text.goals.add));
    await user.click(button(text.goals.add));

    expect(screen.getAllByRole('textbox')).toHaveLength(MAX_ACTIVE_GOALS);
    expect(screen.queryByRole('button', { name: text.goals.add })).toBeNull();
  });

  it('[TC-02-03] does not flag a freshly added goal field as invalid', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), 'Speak fluently');

    await user.click(button(text.goals.add));

    expect(goalField(2)).toBeValid();
    expect(screen.queryByText(text.errors.goalRequired)).toBeNull();
  });

  it('[TC-02-03] removes an extra goal field', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);
    await user.click(button(text.goals.add));

    await user.click(button(removeGoalLabel(2)));

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    for (const index of [1, 2]) {
      expect(
        screen.queryByRole('button', { name: removeGoalLabel(index) }),
      ).toBeNull();
    }
  });

  it('[TC-02-03] does not finish with a blank goal and announces the error', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoalsApi(() => jsonResponse(TEST_PROFILE));
    const onCompleted = renderWizard();
    await reachGoals(user);

    await user.click(button(uk.common.actions.finish));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.goalRequired,
    );
    expect(goalField(1)).toBeInvalid();
    expect(requests).toHaveLength(0);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('[TC-02-04] shows a localized message for an over-long goal', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);

    await user.click(goalField(1));
    await user.paste('x'.repeat(GOAL_TITLE_MAX + 1));
    await user.click(button(uk.common.actions.finish));

    expect(
      await screen.findByText(withMax(text.errors.goalTooLong, GOAL_TITLE_MAX)),
    ).toBeInTheDocument();
  });

  it('[TC-02-03] keeps the entered values when going back', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);
    await user.type(goalField(1), 'Speak fluently');

    await user.click(button(text.actions.back));
    expect(chip('Travel for work')).toBeChecked();
    await user.click(button(text.actions.back));

    expect(levelOption('B1')).toBeChecked();
    await user.click(button(text.actions.next));
    await user.click(button(text.actions.next));
    expect(goalField(1)).toHaveValue('Speak fluently');
  });

  it('[TC-02-03] moves focus to the previous step after Back', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachGoals(user);
    expect(screen.getByRole('group', { name: text.goals.title })).toHaveFocus();

    await user.click(button(text.actions.back));
    expect(
      screen.getByRole('group', { name: text.scenes.title }),
    ).toHaveFocus();

    await user.click(button(text.actions.back));
    expect(screen.getByRole('group', { name: text.level.title })).toHaveFocus();
  });
});
