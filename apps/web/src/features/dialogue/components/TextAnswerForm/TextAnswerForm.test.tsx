import { ANSWER_TEXT_MAX } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { TextAnswerForm } from './TextAnswerForm';

function renderForm(
  submit = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true),
  phase: AnswerPhase = 'idle',
) {
  renderWithProviders(<TextAnswerForm phase={phase} submit={submit} />);
  const field = screen.getByLabelText(uk.dialogue.form.label);
  const button = screen.getByRole('button', { name: uk.dialogue.form.submit });
  return { submit, field, button };
}

describe('TextAnswerForm', () => {
  it('[TC-04-04] labels the English field and starts with an empty counter', () => {
    const { field } = renderForm();

    expect(field).toHaveAttribute('lang', 'en');
    expect(field).toHaveValue('');
    expect(screen.getByText(`0 / ${ANSWER_TEXT_MAX}`)).toBeInTheDocument();
  });

  it('[TC-04-04] counts the typed characters', async () => {
    const user = userEvent.setup();
    const { field } = renderForm();

    await user.type(field, 'I very like');

    expect(screen.getByText(`11 / ${ANSWER_TEXT_MAX}`)).toBeInTheDocument();
  });

  it('[TC-04-04] submits the trimmed text and clears the field after success', async () => {
    const user = userEvent.setup();
    const { submit, field, button } = renderForm();

    await user.type(field, '  I very like it  ');
    await user.click(button);

    await waitFor(() => expect(field).toHaveValue(''));
    expect(submit).toHaveBeenCalledExactlyOnceWith('I very like it');
  });

  it('[TC-04-08] keeps the typed text when the submission failed', async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn<(text: string) => Promise<boolean>>()
      .mockResolvedValue(false);
    const { field, button } = renderForm(submit);

    await user.type(field, 'I very like');
    await user.click(button);

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(field).toHaveValue('I very like');
    expect(button).toBeEnabled();
  });

  it.each(['', '   '])(
    '[TC-04-04] asks for an answer instead of sending %j',
    async (text) => {
      const user = userEvent.setup();
      const { submit, field, button } = renderForm();

      if (text !== '') {
        await user.type(field, text);
      }
      await user.click(button);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        uk.dialogue.form.errors.required,
      );
      expect(submit).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-04] rejects an answer over the limit with the limit in the message', async () => {
    const user = userEvent.setup();
    const { submit, field, button } = renderForm();

    await user.click(field);
    await user.paste('a'.repeat(ANSWER_TEXT_MAX + 1));
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.dialogue.form.errors.tooLong.replace('{{max}}', `${ANSWER_TEXT_MAX}`),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it.each<AnswerPhase>(['sending', 'analyzing'])(
    '[TC-04-12] disables the submit button while the phase is %s',
    (phase) => {
      const { button } = renderForm(undefined, phase);

      expect(button).toBeDisabled();
    },
  );

  it.each(['sending', 'analyzing'] as const)(
    '[TC-04-04] makes the field read-only while the answer is %s',
    (phase) => {
      const { field } = renderForm(undefined, phase);

      expect(field).toHaveAttribute('readonly');
    },
  );

  it('[TC-04-04] keeps the field editable while idle', () => {
    const { field } = renderForm();

    expect(field).not.toHaveAttribute('readonly');
  });

  it('[TC-04-05] locks the field and the button while another way of answering is in progress', () => {
    renderWithProviders(
      <TextAnswerForm phase="idle" submit={vi.fn()} disabled />,
    );

    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveAttribute(
      'readonly',
    );
    expect(
      screen.getByRole('button', { name: uk.dialogue.form.submit }),
    ).toBeDisabled();
  });

  it('[TC-04-05] focuses the field on mount only when asked to', () => {
    const { unmount } = renderWithProviders(
      <TextAnswerForm phase="idle" submit={vi.fn()} autoFocus />,
    );
    expect(screen.getByLabelText(uk.dialogue.form.label)).toHaveFocus();
    unmount();

    renderWithProviders(<TextAnswerForm phase="idle" submit={vi.fn()} />);
    expect(screen.getByLabelText(uk.dialogue.form.label)).not.toHaveFocus();
  });

  it('[TC-04-08] returns focus to the field when the submission failed', async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn<(text: string) => Promise<boolean>>()
      .mockResolvedValue(false);
    const { field, button } = renderForm(submit);

    await user.type(field, 'I very like');
    await user.click(button);

    await waitFor(() => expect(field).toHaveFocus());
  });
});
