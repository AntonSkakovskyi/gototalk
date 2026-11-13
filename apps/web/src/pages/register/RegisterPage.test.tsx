import { ERROR_CODES } from '@gototalk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import {
  authResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { getSession } from '@/shared/session/session-store';

const fetchMock = vi.fn<typeof fetch>();

function renderRegister() {
  return renderWithProviders(<App />, {
    route: '/register',
    session: 'anonymous',
  });
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(uk.auth.fields.email), email);
  await user.type(screen.getByLabelText(uk.auth.fields.password), password);
  await user.click(
    screen.getByRole('button', { name: uk.auth.register.submit }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegisterPage', () => {
  it('[TC-01-03] renders the form without the bottom navigation and links to login', () => {
    renderRegister();

    expect(
      screen.getByRole('heading', { level: 1, name: uk.auth.register.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(uk.auth.fields.email)).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText(uk.auth.fields.password)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: uk.auth.register.toLogin }),
    ).toHaveAttribute('href', '/login');
  });

  it('[TC-01-03] shows the validation error and sends no request for a 7-character password', async () => {
    renderRegister();

    await fillAndSubmit('anna@example.com', '1234567');

    expect(
      await screen.findByText(uk.auth.validation.passwordTooShort),
    ).toBeInTheDocument();
    const passwordInput = screen.getByLabelText(uk.auth.fields.password);
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAccessibleDescription(
      expect.stringContaining(uk.auth.validation.passwordTooShort),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[TC-01-03] shows the validation error for an invalid email without a request', async () => {
    renderRegister();

    await fillAndSubmit('not-an-email', 'long-enough-password');

    expect(
      await screen.findByText(uk.auth.validation.emailInvalid),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[TC-01-03] shows the too-long password error without a request', async () => {
    renderRegister();

    await fillAndSubmit('anna@example.com', 'x'.repeat(129));

    expect(
      await screen.findByText(uk.auth.validation.passwordTooLong),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[TC-01-03] registers with the entered credentials and continues to the consent screen', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(authResponse('reg-token'), 201),
    );
    renderRegister();

    await fillAndSubmit('anna@example.com', 'long-enough-password');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.consent.title,
      }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'anna@example.com',
      password: 'long-enough-password',
    });
    expect(getSession().accessToken).toBe('reg-token');
  });

  it('[TC-01-03] shows the email-taken message on EMAIL_TAKEN', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, ERROR_CODES.EMAIL_TAKEN),
    );
    renderRegister();

    await fillAndSubmit('anna@example.com', 'long-enough-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.auth.errors.emailTaken,
    );
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] shows the generic error for a server validation error', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, 'VALIDATION_ERROR'));
    renderRegister();

    await fillAndSubmit('anna@example.com', 'long-enough-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.auth.errors.generic,
    );
  });
});
