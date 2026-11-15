import { ERROR_CODES, type SessionDetails } from '@gototalk/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sessionKeys } from '@/entities/session/api/session-details';
import { uk } from '@/shared/i18n/resources';
import { deferred } from '@/shared/testing/deferred';
import { mockDialogueApi } from '@/features/dialogue/testing/dialogue-mocks';
import { DIALOGUE_SESSION_ID } from '@/entities/session/testing/session-entity-mocks';
import { LocationProbe } from '@/shared/testing/LocationProbe';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { errorResponse } from '@/shared/testing/http-responses';
import { testSessionDetails } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { FinishAction } from './FinishAction';

function renderAction(details: SessionDetails, disabled = false) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(sessionKeys.details(DIALOGUE_SESSION_ID), details);
  return renderWithProviders(
    <>
      <FinishAction details={details} disabled={disabled} />
      <LocationProbe />
    </>,
    { queryClient, route: `/sessions/${DIALOGUE_SESSION_ID}` },
  );
}

function openButton() {
  return screen.getByRole('button', { name: uk.dialogue.finish.open });
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(openButton());
  return screen.findByRole('dialog', { name: uk.dialogue.finish.title });
}

function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole('button', {
    name: uk.common.actions.finish,
  });
}

describe('FinishAction', () => {
  it('[TC-04-04] opens a confirmation that explains the consequences', async () => {
    const user = userEvent.setup();
    renderAction(testSessionDetails());

    const dialog = await openModal(user);

    expect(within(dialog).getByText(uk.dialogue.finish.text)).toBeVisible();
    expect(confirmButton(dialog)).toBeEnabled();
    expect(
      within(dialog).getByRole('button', { name: uk.common.actions.cancel }),
    ).toBeEnabled();
  });

  it('[TC-04-04] closes on cancel without sending a request', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderAction(testSessionDetails());

    const dialog = await openModal(user);
    await user.click(
      within(dialog).getByRole('button', { name: uk.common.actions.cancel }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(api.finishRequests()).toHaveLength(0);
    expect(screen.getByTestId('location-path')).toHaveTextContent(
      `/sessions/${DIALOGUE_SESSION_ID}`,
    );
  });

  it('[TC-04-04] finishes with exactly one request and opens the report', async () => {
    const user = userEvent.setup();
    const api = mockDialogueApi();
    renderAction(testSessionDetails());

    const dialog = await openModal(user);
    await user.click(confirmButton(dialog));

    await waitFor(() =>
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${DIALOGUE_SESSION_ID}/report`,
      ),
    );
    expect(api.finishRequests()).toHaveLength(1);
  });

  it('[TC-04-04] shows the loading state and blocks a second request while finishing', async () => {
    const user = userEvent.setup();
    const release = deferred();
    const api = mockDialogueApi({ finish: () => release.promise });
    renderAction(testSessionDetails());

    const dialog = await openModal(user);
    await user.click(confirmButton(dialog));

    await waitFor(() => expect(confirmButton(dialog)).toBeDisabled());
    expect(confirmButton(dialog)).toHaveAttribute('data-loading', 'true');
    expect(
      within(dialog).getByRole('button', { name: uk.common.actions.cancel }),
    ).toBeDisabled();
    await user.click(confirmButton(dialog));
    expect(api.finishRequests()).toHaveLength(1);
  });

  it.each([
    [errorResponse(500, 'INTERNAL_ERROR'), uk.errors.generic],
    [
      errorResponse(404, ERROR_CODES.SESSION_NOT_FOUND),
      uk.session.errors.notFound,
    ],
  ])(
    '[TC-04-08] keeps the modal open and shows the mapped error (%#)',
    async (response, message) => {
      const user = userEvent.setup();
      mockDialogueApi({ finish: () => response });
      renderAction(testSessionDetails());

      const dialog = await openModal(user);
      await user.click(confirmButton(dialog));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        message,
      );
      expect(dialog).toBeInTheDocument();
      expect(confirmButton(dialog)).toBeEnabled();
      expect(screen.getByTestId('location-path')).toHaveTextContent(
        `/sessions/${DIALOGUE_SESSION_ID}`,
      );
    },
  );

  it('[TC-04-08] does not show the previous error when the modal is opened again', async () => {
    const user = userEvent.setup();
    mockDialogueApi({ finish: () => errorResponse(500, 'INTERNAL_ERROR') });
    renderAction(testSessionDetails());

    const dialog = await openModal(user);
    await user.click(confirmButton(dialog));
    await within(dialog).findByRole('alert');
    await user.click(
      within(dialog).getByRole('button', { name: uk.common.actions.cancel }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    const reopened = await openModal(user);

    expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('[TC-04-04] disables the button while an answer is being processed', () => {
    renderAction(testSessionDetails(), true);

    expect(openButton()).toBeDisabled();
  });

  it.each([
    [0, 'filled'],
    [3, 'outline'],
  ])(
    '[TC-04-04] with %i plan questions left the button variant is %s',
    (planRemaining, variant) => {
      renderAction(testSessionDetails({ planRemaining }));

      expect(openButton()).toHaveAttribute('data-variant', variant);
    },
  );

  it('[TC-04-04] renders nothing for a finished session', () => {
    renderAction(
      testSessionDetails({
        status: 'finished',
        endedAt: '2026-11-13T10:20:00.000Z',
      }),
    );

    expect(
      screen.queryByRole('button', { name: uk.dialogue.finish.open }),
    ).not.toBeInTheDocument();
  });
});
