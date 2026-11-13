import { SCENE_PRESETS } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import {
  button,
  chip,
  chooseLevel,
  presets,
  progress,
  renderWizard,
  text,
} from './wizard-test-helpers';

describe('OnboardingWizard level step', () => {
  it('[TC-02-03] explains that the level can be changed later in the profile', () => {
    renderWizard();

    expect(screen.getByText(text.level.hint)).toBeInTheDocument();
  });

  it('[TC-02-03] blocks the first step until a level is chosen', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(button(text.actions.next));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.levelRequired,
    );
    expect(screen.getByText(progress(1))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: text.actions.back }),
    ).toBeNull();
  });

  it('[TC-02-03] lists every level with its Ukrainian description', () => {
    renderWizard();

    for (const level of ['A2', 'B1', 'B2', 'C1'] as const) {
      expect(
        screen.getByRole('radio', {
          name: new RegExp(uk.profile.levels[level].description),
        }),
      ).toBeInTheDocument();
    }
  });

  it('[TC-02-03] opens the scenes step after a level is picked', async () => {
    const user = userEvent.setup();
    renderWizard();

    await chooseLevel(user, 'B1');
    await user.click(button(text.actions.next));

    expect(screen.getByText(progress(2))).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: text.scenes.title }),
    ).toBeInTheDocument();
    for (const preset of SCENE_PRESETS) {
      expect(chip(presets[preset])).not.toBeChecked();
    }
  });

  it('[TC-02-03] does not steal focus on the first render', () => {
    renderWizard();

    expect(
      screen.getByRole('group', { name: text.level.title }),
    ).not.toHaveFocus();
  });

  it('[TC-02-03] moves focus to the new step after Next', async () => {
    const user = userEvent.setup();
    renderWizard();
    await chooseLevel(user, 'B1');

    await user.click(button(text.actions.next));

    expect(
      screen.getByRole('group', { name: text.scenes.title }),
    ).toHaveFocus();
  });

  it('[TC-02-03] keeps focus in place when the step stays blocked', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(button(text.actions.next));

    expect(button(text.actions.next)).toHaveFocus();
  });
});
