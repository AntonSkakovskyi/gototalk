import { GOAL_TITLE_MAX, UpdateGoalRequestSchema } from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/test-fixtures';
import {
  FLUENT,
  MEETINGS,
  fill,
  goalButton,
  renderGoals,
  stubGoals,
  text,
} from './goals-test-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

function titleField() {
  return screen.getByLabelText(text.edit.label);
}

async function startEditing(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(FLUENT.title);
  await user.click(goalButton('editLabel', FLUENT.title));
}

describe('GoalsSection edit title', () => {
  it('[TC-02-03] renames a goal inline and returns focus to its edit button', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT, MEETINGS]);
    renderGoals();
    await startEditing(user);
    expect(titleField()).toHaveFocus();
    expect(titleField()).toHaveValue(FLUENT.title);

    await user.clear(titleField());
    await user.type(titleField(), ' Speak confidently ');
    await user.click(
      screen.getByRole('button', { name: uk.profile.actions.save }),
    );

    expect(await screen.findByText('Speak confidently')).toBeInTheDocument();
    expect(requests.find(({ method }) => method === 'PATCH')?.body).toEqual({
      title: 'Speak confidently',
    });
    expect(screen.queryByLabelText(text.edit.label)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(goalButton('editLabel', 'Speak confidently')).toHaveFocus(),
    );
  });

  it('[TC-02-04] cancel keeps the title and sends nothing', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT]);
    renderGoals();
    await startEditing(user);
    await user.type(titleField(), ' changed');

    await user.click(
      screen.getByRole('button', { name: uk.profile.actions.cancel }),
    );

    expect(screen.getByText(FLUENT.title)).toBeInTheDocument();
    expect(requests.some(({ method }) => method === 'PATCH')).toBe(false);
  });

  it('[TC-02-04] disables cancel while saving and never shows the old title once the form closes', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let currentTitle = FLUENT.title;
    mockApi({
      'GET /api/goals': () =>
        jsonResponse([{ ...FLUENT, title: currentTitle }]),
      [`PATCH /api/goals/${FLUENT.id}`]: async ({ body }) => {
        await gate;
        currentTitle =
          UpdateGoalRequestSchema.parse(body).title ?? currentTitle;
        return jsonResponse({ ...FLUENT, title: currentTitle });
      },
    });
    renderGoals();
    await startEditing(user);
    await user.type(titleField(), ' renamed');

    await user.click(
      screen.getByRole('button', { name: uk.profile.actions.save }),
    );

    expect(
      screen.getByRole('button', { name: uk.profile.actions.cancel }),
    ).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.queryByLabelText(text.edit.label)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(FLUENT.title)).not.toBeInTheDocument();
    expect(screen.getByText(`${FLUENT.title} renamed`)).toBeInTheDocument();
  });

  it('[TC-02-04] blocks an empty title with an announced message', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT]);
    renderGoals();
    await startEditing(user);

    await user.clear(titleField());
    await user.click(
      screen.getByRole('button', { name: uk.profile.actions.save }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.profile.onboarding.errors.goalRequired,
    );
    expect(titleField()).toBeInvalid();
    expect(requests.some(({ method }) => method === 'PATCH')).toBe(false);
  });

  it('[TC-02-04] blocks a title longer than the limit', async () => {
    const user = userEvent.setup();
    stubGoals([FLUENT]);
    renderGoals();
    await startEditing(user);
    await user.clear(titleField());
    await user.paste('x'.repeat(GOAL_TITLE_MAX + 1));

    await user.click(
      screen.getByRole('button', { name: uk.profile.actions.save }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      fill(uk.profile.onboarding.errors.goalTooLong, { max: GOAL_TITLE_MAX }),
    );
  });
});

describe('GoalsSection delete goal', () => {
  it('[TC-02-03] asks for confirmation and deletes the goal after it', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT, MEETINGS]);
    renderGoals();
    await screen.findByText(FLUENT.title);

    await user.click(goalButton('deleteLabel', FLUENT.title));

    const dialog = await screen.findByRole('dialog', {
      name: text.delete.title,
    });
    expect(
      within(dialog).getByText(fill(text.delete.text, { title: FLUENT.title })),
    ).toBeInTheDocument();
    expect(requests.some(({ method }) => method === 'DELETE')).toBe(false);

    await user.click(
      within(dialog).getByRole('button', { name: uk.profile.actions.delete }),
    );

    await waitFor(() =>
      expect(screen.queryByText(FLUENT.title)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(MEETINGS.title)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: text.title })).toHaveFocus();
    const deletion = requests.find(({ method }) => method === 'DELETE');
    expect(deletion?.path).toBe(`/api/goals/${FLUENT.id}`);
  });

  it('[TC-02-03] cancel closes the dialog and keeps the goal', async () => {
    const user = userEvent.setup();
    const { requests } = stubGoals([FLUENT]);
    renderGoals();
    await screen.findByText(FLUENT.title);
    await user.click(goalButton('deleteLabel', FLUENT.title));
    const dialog = await screen.findByRole('dialog');

    await user.click(
      within(dialog).getByRole('button', { name: uk.profile.actions.cancel }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByText(FLUENT.title)).toBeInTheDocument();
    expect(requests.some(({ method }) => method === 'DELETE')).toBe(false);
  });
});
