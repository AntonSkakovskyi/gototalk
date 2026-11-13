import { screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import uk from '../i18n/uk.json';
import {
  TEST_USER,
  authResponse,
  errorResponse,
  jsonResponse,
} from '../test-fixtures';
import { renderWithProviders } from '../test-utils';
import { AuthBootstrap } from './AuthBootstrap';
import { getSession } from './session-store';

const fetchMock = vi.fn<typeof fetch>();

function renderBootstrap(strict = false) {
  const ui = (
    <AuthBootstrap>
      <p>App content</p>
    </AuthBootstrap>
  );
  return renderWithProviders(strict ? <StrictMode>{ui}</StrictMode> : ui);
}

function refreshCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthBootstrap', () => {
  it('[TC-01-03] shows an accessible loader until the refresh settles, then the children', async () => {
    let respond: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );

    renderBootstrap();

    expect(
      screen.getByRole('status', { name: uk.auth.loading }),
    ).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();

    respond(jsonResponse(authResponse()));

    expect(await screen.findByText('App content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(getSession()).toMatchObject({
      status: 'authenticated',
      user: TEST_USER,
    });
  });

  it('[TC-01-03] renders the children as anonymous when there is no valid refresh cookie', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'));

    renderBootstrap();

    expect(await screen.findByText('App content')).toBeInTheDocument();
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] calls /api/auth/refresh exactly once on mount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(authResponse()));

    renderBootstrap();
    await screen.findByText('App content');

    expect(refreshCalls()).toHaveLength(1);
  });

  it('[TC-01-03] calls /api/auth/refresh exactly once under StrictMode', async () => {
    fetchMock.mockResolvedValue(jsonResponse(authResponse()));

    renderBootstrap(true);
    await screen.findByText('App content');

    expect(refreshCalls()).toHaveLength(1);
  });

  it('[TC-01-03] falls back to anonymous when the refresh fails with a server error', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'SERVICE_UNAVAILABLE'));

    renderBootstrap();

    await waitFor(() =>
      expect(screen.getByText('App content')).toBeInTheDocument(),
    );
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] skips the refresh when the session is already known', () => {
    renderWithProviders(
      <AuthBootstrap>
        <p>App content</p>
      </AuthBootstrap>,
      { session: { user: TEST_USER, accessToken: 'seeded' } },
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
