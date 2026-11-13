import { ERROR_CODES } from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import {
  TEST_PROFILE,
  TEST_USER,
  authResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { getSession } from '@/shared/session/session-store';

const fetchMock = vi.fn<typeof fetch>();

const CONSENTED_USER = { ...TEST_USER, consentAt: '2026-01-01T10:00:00.000Z' };

function renderLogin() {
  return renderWithProviders(<App />, {
    route: '/login',
    session: 'anonymous',
  });
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(uk.auth.fields.email), email);
  await user.type(screen.getByLabelText(uk.auth.fields.password), password);
  await user.click(screen.getByRole('button', { name: uk.auth.login.submit }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('LoginPage', () => {
  it('[TC-01-03] renders the form without the bottom navigation and links to registration', () => {
    renderLogin();

    expect(
      screen.getByRole('heading', { level: 1, name: uk.auth.login.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(uk.auth.fields.email)).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText(uk.auth.fields.password)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: uk.auth.login.toRegister }),
    ).toHaveAttribute('href', '/register');
  });

  it('[TC-01-03] submits the entered credentials and continues to the main screen', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(authResponse('login-token', CONSENTED_USER)),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PROFILE));
    renderLogin();

    await fillAndSubmit('anna@example.com', 'secret-pass');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'anna@example.com',
      password: 'secret-pass',
    });
    expect(getSession().accessToken).toBe('login-token');
  });

  it('[TC-01-03] continues to the consent screen when the user has not consented yet', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse()));
    renderLogin();

    await fillAndSubmit('anna@example.com', 'secret-pass');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.consent.title,
      }),
    ).toBeInTheDocument();
  });

  it('[TC-01-03] shows validation messages and sends no request for an empty form', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getByRole('button', { name: uk.auth.login.submit }),
    );

    expect(
      await screen.findByText(uk.auth.validation.emailInvalid),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uk.auth.validation.passwordRequired),
    ).toBeInTheDocument();
    const emailInput = screen.getByLabelText(uk.auth.fields.email);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAccessibleDescription(
      uk.auth.validation.emailInvalid,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[TC-01-05] shows one generic message that does not depend on what was typed', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(401, ERROR_CODES.INVALID_CREDENTIALS)),
    );
    const { unmount } = renderLogin();

    await fillAndSubmit('missing@example.com', 'some-password');
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(uk.auth.errors.invalidCredentials);
    const firstText = first.textContent;
    unmount();

    renderLogin();
    await fillAndSubmit('anna@example.com', 'wrong-password');
    const second = await screen.findByRole('alert');

    expect(second.textContent).toBe(firstText);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-05] shows the generic error for a network failure and re-enables the button', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderLogin();

    await fillAndSubmit('anna@example.com', 'secret-pass');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: uk.auth.login.submit }),
      ).toBeEnabled(),
    );
  });
});
