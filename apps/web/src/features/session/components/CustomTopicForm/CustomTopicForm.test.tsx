import { TOPIC_MAX } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { CustomTopicForm } from './CustomTopicForm';

const text = uk.session.proposal.custom;

function setup() {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <CustomTopicForm onSubmit={onSubmit} onCancel={onCancel} />,
  );
  return { onSubmit, onCancel, user: userEvent.setup() };
}

const field = () => screen.getByRole('textbox', { name: text.label });
const submit = () => screen.getByRole('button', { name: text.submit });

describe('CustomTopicForm', () => {
  it('[TC-03-03] focuses the labelled field when it opens and limits its length', async () => {
    setup();

    await waitFor(() => expect(field()).toHaveFocus());
    expect(field()).toHaveAttribute('maxlength', String(TOPIC_MAX));
  });

  it('[TC-03-03] shows the required error for an empty value and submits nothing', async () => {
    const { user, onSubmit } = setup();

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.required,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[TC-03-03] treats a whitespace-only value as empty', async () => {
    const { user, onSubmit } = setup();

    await user.type(field(), '    ');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      text.errors.required,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('[TC-03-03] does not accept more characters than the maximum', async () => {
    const { user } = setup();

    await user.click(field());
    await user.paste('a'.repeat(TOPIC_MAX + 1));

    expect(field()).toHaveValue('a'.repeat(TOPIC_MAX));
  });

  it('[TC-03-03] accepts a value of exactly the maximum length', async () => {
    const { user, onSubmit } = setup();

    await user.click(field());
    await user.paste('a'.repeat(TOPIC_MAX));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('a'.repeat(TOPIC_MAX));
  });

  it('[TC-03-03] submits the trimmed value exactly once', async () => {
    const { user, onSubmit } = setup();

    await user.type(field(), '  My cat  ');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('My cat');
  });

  it('[TC-03-03] submits with Enter and clears the error once the value is valid', async () => {
    const { user, onSubmit } = setup();
    await user.type(field(), '{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(field(), 'My cat{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('My cat'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-03-03] cancel calls onCancel without submitting', async () => {
    const { user, onSubmit, onCancel } = setup();

    await user.type(field(), 'My cat');
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.cancel }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
