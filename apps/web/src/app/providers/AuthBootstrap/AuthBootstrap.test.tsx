import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import uk from '@/shared/i18n/uk.json';
import {
  TEST_USER,
  authResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { AuthBootstrap } from './AuthBootstrap';
import { getSession } from '@/shared/session/session-store';

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
      screen.getByRole('status', { name: uk.common.loading }),
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

  it('[TC-01-03] shows a retry screen instead of going anonymous when the refresh fails with a server error', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'SERVICE_UNAVAILABLE'));

    renderBootstrap();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.app.gate.error,
    );
    expect(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    ).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
    expect(getSession().status).toBe('unknown');
  });

  it('[TC-01-03] shows the retry screen when the refresh fails with a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderBootstrap();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
    expect(getSession().status).toBe('unknown');
    expect(refreshCalls()).toHaveLength(1);
  });

  it('[TC-01-03] retries the refresh with a loader in between and restores the session on success', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    let respond: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );
    const user = userEvent.setup();

    renderBootstrap();
    await user.click(
      await screen.findByRole('button', { name: uk.common.actions.retry }),
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    respond(jsonResponse(authResponse()));

    expect(await screen.findByText('App content')).toBeInTheDocument();
    expect(refreshCalls()).toHaveLength(2);
    expect(getSession()).toMatchObject({
      status: 'authenticated',
      user: TEST_USER,
    });
  });

  it('[TC-01-03] goes anonymous when the retry is rejected with 401', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'));
    const user = userEvent.setup();

    renderBootstrap();
    await user.click(
      await screen.findByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText('App content')).toBeInTheDocument();
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] shows the retry screen again when the retry fails too', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));
    const user = userEvent.setup();

    renderBootstrap();
    await user.click(
      await screen.findByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(refreshCalls()).toHaveLength(2);
  });

  it('[TC-01-03] fires one refresh under StrictMode even when it fails', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));

    renderBootstrap(true);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(refreshCalls()).toHaveLength(1);
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
