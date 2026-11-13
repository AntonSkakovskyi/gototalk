import { MAX_SCENES, MAX_SCENE_LENGTH, SCENE_PRESETS } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addScene,
  button,
  chip,
  openScenes,
  presets,
  progress,
  renderWizard,
  sceneInput,
  text,
  withMax,
} from './wizard-test-helpers';

describe('OnboardingWizard scenes step', () => {
  it('[TC-02-03] blocks the step when nothing is selected', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);

    await user.click(button(text.actions.next));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.scenesRequired,
    );
    expect(screen.getByText(progress(2))).toBeInTheDocument();
  });

  it('[TC-02-03] lists a custom scene as an extra chip next to the presets', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);

    await user.click(chip(presets.travel));
    await addScene(user, '  Travel for work ');

    expect(chip(presets.travel)).toBeChecked();
    expect(chip('Travel for work')).toBeChecked();
    expect(sceneInput()).toHaveValue('');
  });

  it('[TC-02-03] adds a custom scene with Enter without leaving the step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);

    await user.type(sceneInput(), 'Cafe{Enter}');

    expect(chip('Cafe')).toBeChecked();
    expect(screen.getByText(progress(2))).toBeInTheDocument();
  });

  it('[TC-02-03] removes a custom scene by unchecking its chip', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    await addScene(user, 'Cafe');

    await user.click(chip('Cafe'));

    expect(screen.queryByRole('checkbox', { name: 'Cafe' })).toBeNull();
  });

  it('[TC-02-03] announces a duplicate custom scene as an alert', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    await addScene(user, 'Cafe');

    await addScene(user, 'Cafe');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.sceneDuplicate,
    );
    expect(sceneInput()).toBeInvalid();
  });

  it('[TC-02-03] blocks the seventh scene', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    for (const preset of SCENE_PRESETS) {
      await user.click(chip(presets[preset]));
    }
    await addScene(user, 'Own one');

    await addScene(user, 'Own two');

    expect(
      screen.getByText(withMax(text.errors.scenesTooMany, MAX_SCENES)),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Own two' })).toBeNull();
    expect(chip('Own one')).toBeChecked();
  });

  it('[TC-02-03] clears the custom scene error as the user types', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    await user.click(button(text.scenes.add));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.sceneEmpty,
    );

    await user.type(sceneInput(), 'C');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(sceneInput()).toBeValid();
  });

  it('[TC-02-03] adds an unsent custom scene when pressing Next', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    await user.type(sceneInput(), ' Cafe ');

    await user.click(button(text.actions.next));

    expect(screen.getByText(progress(3))).toBeInTheDocument();
    await user.click(button(text.actions.back));
    expect(chip('Cafe')).toBeChecked();
    expect(sceneInput()).toHaveValue('');
  });

  it('[TC-02-03] blocks Next and shows the error for an invalid unsent scene', async () => {
    const user = userEvent.setup();
    renderWizard();
    await openScenes(user);
    await user.click(chip(presets.travel));
    await user.click(sceneInput());
    await user.paste('x'.repeat(MAX_SCENE_LENGTH + 1));

    await user.click(button(text.actions.next));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      withMax(text.errors.sceneTooLong, MAX_SCENE_LENGTH),
    );
    expect(screen.getByText(progress(2))).toBeInTheDocument();
  });
});
