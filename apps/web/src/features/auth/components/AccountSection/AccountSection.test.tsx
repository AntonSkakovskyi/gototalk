import { ERROR_CODES } from '@gototalk/shared';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import {
  EMPTY_LEARNER_MODEL,
  TEST_PROFILE,
  TEST_USER,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { clearQueryCacheOnSessionEnd } from '@/shared/session/query-cache';
import { getSession } from '@/shared/session/session-store';

const fetchMock = vi.fn<typeof fetch>();

// The profile page also loads the profile, goals and learner model; fetchMock only sees the account requests.
const PAGE_READS: Record<string, Response> = {
  '/api/profile': jsonResponse(TEST_PROFILE),
  '/api/goals': jsonResponse([]),
  '/api/profile/learner-model': jsonResponse(EMPTY_LEARNER_MODEL),
};

function routeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const pageRead = PAGE_READS[String(input)];
  return pageRead ? Promise.resolve(pageRead.clone()) : fetchMock(input, init);
}

const account = uk.pages.profile.account;

const SESSION = {
  accessToken: 'access-1',
  user: { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' },
};

function renderProfile() {
  return renderWithProviders(<App />, {
    route: '/profile',
    session: SESSION,
  });
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: account.delete.open }));
  return screen.findByRole('dialog', { name: account.delete.title });
}

function loginHeading() {
  return screen.findByRole('heading', {
    level: 1,
    name: uk.auth.login.title,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', routeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountSection', () => {
  it('[TC-01-03] keeps the page heading and shows the email with the account actions', () => {
    renderProfile();

    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.profile.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: account.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: account.logout }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: account.delete.open }),
    ).toBeInTheDocument();
  });

  it('[TC-01-03] logs out through the API and lands on the login screen', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: account.logout }));

    expect(await loginHeading()).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/logout');
    expect(init?.method).toBe('POST');
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] still lands on the login screen when the logout request fails', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: account.logout }));

    expect(await loginHeading()).toBeInTheDocument();
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-02] opens a dialog that warns about irreversible removal and asks for the password', async () => {
    const user = userEvent.setup();
    renderProfile();

    const dialog = await openDeleteDialog(user);

    expect(
      within(dialog).getByText(account.delete.warning),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(uk.auth.fields.password),
    ).toHaveAttribute('autocomplete', 'current-password');
    expect(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: account.delete.cancel }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[TC-01-02] shows the validation message and sends no request for an empty password', async () => {
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);

    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(
      await within(dialog).findByText(uk.auth.validation.passwordRequired),
    ).toBeInTheDocument();
    const field = within(dialog).getByLabelText(uk.auth.fields.password);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(
      uk.auth.validation.passwordRequired,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSession().status).toBe('authenticated');
  });

  it('[TC-01-02] keeps the dialog open and the session alive after a wrong password', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(403, ERROR_CODES.INVALID_PASSWORD),
    );
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);

    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'wrong-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      account.delete.invalidPassword,
    );
    expect(dialog).toBeInTheDocument();
    const field = within(dialog).getByLabelText(uk.auth.fields.password);
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(getSession().status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('heading', { level: 1, name: uk.auth.login.title }),
    ).not.toBeInTheDocument();
  });

  it('[TC-01-02] shows a generic message for a network failure and keeps the session', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);

    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'secret-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      uk.auth.errors.generic,
    );
    expect(getSession().status).toBe('authenticated');
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: account.delete.confirm }),
      ).toBeEnabled(),
    );
  });

  it('[TC-01-02] deletes the account with the entered password and lands on the login screen', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);

    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'secret-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(await loginHeading()).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/me');
    expect(init?.method).toBe('DELETE');
    expect(JSON.parse(String(init?.body))).toEqual({ password: 'secret-pass' });
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-02] cancel closes the dialog and the next opening starts clean', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(403, ERROR_CODES.INVALID_PASSWORD),
    );
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);
    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'wrong-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );
    await within(dialog).findByRole('alert');

    await user.click(
      within(dialog).getByRole('button', { name: account.delete.cancel }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(getSession().status).toBe('authenticated');

    const reopened = await openDeleteDialog(user);
    expect(
      within(reopened).getByLabelText(uk.auth.fields.password),
    ).toHaveValue('');
    expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-02] cannot be closed while the request is pending and shows the error after a network failure', async () => {
    let rejectRequest: (reason: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
    );
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);
    const buttonsBefore = within(dialog).getAllByRole('button').length;
    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'secret-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.keyboard('{Escape}');
    // Longer than the 200 ms exit transition, after which a closed dialog leaves the DOM.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button')).toHaveLength(
      buttonsBefore - 1,
    );
    expect(
      within(dialog).getByRole('button', { name: account.delete.cancel }),
    ).toBeDisabled();

    rejectRequest(new TypeError('Failed to fetch'));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      uk.auth.errors.generic,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getSession().status).toBe('authenticated');
  });

  it('[TC-01-02] clears the query cache after the account is deleted', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const queryClient = new QueryClient();
    queryClient.setQueryData(['words'], [{ id: 1 }]);
    const unbind = clearQueryCacheOnSessionEnd(queryClient);
    const user = userEvent.setup();
    renderWithProviders(<App />, {
      route: '/profile',
      session: SESSION,
      queryClient,
    });
    const dialog = await openDeleteDialog(user);

    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'secret-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(await loginHeading()).toBeInTheDocument();
    expect(queryClient.getQueryData(['words'])).toBeUndefined();
    unbind();
  });

  it('[TC-01-02] ends on the login screen when the token is expired and the refresh fails', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(401, 'UNAUTHORIZED')),
    );
    const user = userEvent.setup();
    renderProfile();
    const dialog = await openDeleteDialog(user);

    await user.type(
      within(dialog).getByLabelText(uk.auth.fields.password),
      'secret-pass',
    );
    await user.click(
      within(dialog).getByRole('button', { name: account.delete.confirm }),
    );

    expect(await loginHeading()).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/me',
      '/api/auth/refresh',
    ]);
    expect(getSession().status).toBe('anonymous');
  });
});
