import type { ConsentInfo } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import uk from '@/shared/i18n/uk.json';
import {
  TEST_PROFILE,
  TEST_USER,
  authResponse,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { getSession } from '@/shared/auth-session/session-store';

const fetchMock = vi.fn<typeof fetch>();

const CONSENT_DATE = '2026-01-01T10:00:00.000Z';

function consentInfo(
  stt: ConsentInfo['providers']['stt'],
  llm: ConsentInfo['providers']['llm'],
): ConsentInfo {
  return { consentAt: null, providers: { stt, llm } };
}

function renderConsent() {
  return renderWithProviders(<App />, {
    route: '/consent',
    session: authResponse(),
  });
}

function agreeButton() {
  return screen.getByRole('button', { name: uk.pages.consent.agree });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('ConsentPage', () => {
  it.each([
    ['fake', 'fake'],
    ['deepgram', 'gemini'],
  ] as const)(
    '[TC-01-07] names the %s speech and %s language model providers from the config',
    async (stt, llm) => {
      fetchMock.mockResolvedValueOnce(jsonResponse(consentInfo(stt, llm)));
      renderConsent();

      const items = await screen.findAllByRole('listitem');

      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent(uk.pages.consent.providers[stt]);
      expect(items[1]).toHaveTextContent(uk.pages.consent.providers[llm]);
      expect(fetchMock.mock.calls[0]![0]).toBe('/api/me/consent');
    },
  );

  it('[TC-01-07] says what is sent, that audio is not stored and that data can be deleted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(consentInfo('deepgram', 'gemini')),
    );
    renderConsent();

    await screen.findAllByRole('listitem');

    expect(screen.getByText(uk.pages.consent.intro)).toBeInTheDocument();
    expect(screen.getByText(uk.pages.consent.transfer)).toBeInTheDocument();
    expect(
      screen.getByText(uk.pages.consent.audioNotStored),
    ).toBeInTheDocument();
    expect(screen.getByText(uk.pages.consent.deletion)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.consent.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('[TC-01-07] keeps the agree button disabled until the provider names are loaded', async () => {
    let resolveInfo: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveInfo = resolve;
      }),
    );
    renderConsent();

    expect(agreeButton()).toBeDisabled();
    expect(
      screen.getByRole('button', { name: uk.pages.consent.logout }),
    ).toBeEnabled();

    resolveInfo(jsonResponse(consentInfo('fake', 'fake')));

    await screen.findAllByRole('listitem');
    expect(agreeButton()).toBeEnabled();
  });

  it('[TC-01-03] posts the consent and continues to the main screen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(consentInfo('fake', 'fake')));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...TEST_USER, consentAt: CONSENT_DATE }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PROFILE));
    const user = userEvent.setup();
    renderConsent();
    await screen.findAllByRole('listitem');

    await user.click(agreeButton());

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.pages.session.title,
      }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/me/consent');
    expect(init?.method).toBe('POST');
    expect(getSession().user?.consentAt).toBe(CONSENT_DATE);
  });

  it('[TC-01-03] shows a generic error and re-enables the button when consent fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(consentInfo('fake', 'fake')));
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    const user = userEvent.setup();
    renderConsent();
    await screen.findAllByRole('listitem');

    await user.click(agreeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(agreeButton()).toBeEnabled();
    expect(getSession().user?.consentAt).toBeNull();
  });

  it('[TC-01-03] logs out and goes to the login screen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(consentInfo('fake', 'fake')));
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const user = userEvent.setup();
    renderConsent();
    await screen.findAllByRole('listitem');

    await user.click(
      screen.getByRole('button', { name: uk.pages.consent.logout }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.auth.login.title,
      }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/auth/logout');
    expect(init?.method).toBe('POST');
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] stays signed in with an error when the logout request fails and logs out on retry', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(consentInfo('fake', 'fake')));
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const user = userEvent.setup();
    renderConsent();
    await screen.findAllByRole('listitem');

    await user.click(
      screen.getByRole('button', { name: uk.pages.consent.logout }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.auth.errors.logoutFailed,
    );
    expect(getSession().status).toBe('authenticated');
    expect(
      screen.getByRole('heading', { level: 1, name: uk.pages.consent.title }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: uk.pages.consent.logout }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: uk.auth.login.title,
      }),
    ).toBeInTheDocument();
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] shows an error with a retry button when the provider info fails to load', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(consentInfo('deepgram', 'gemini')),
    );
    const user = userEvent.setup();
    renderConsent();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(uk.errors.generic);
    expect(agreeButton()).toBeDisabled();

    await user.click(
      within(alert).getByRole('button', { name: uk.common.actions.retry }),
    );

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent(uk.pages.consent.providers.deepgram);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(agreeButton()).toBeEnabled();
  });
});
