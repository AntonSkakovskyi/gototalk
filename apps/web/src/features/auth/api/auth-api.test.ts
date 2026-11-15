import { ERROR_CODES } from '@gototalk/shared';
import { TEST_USER, authResponse } from '@/shared/testing/fixtures/auth';
import {
  emptyResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/http-responses';
import {
  deleteAccount,
  getConsentInfo,
  grantConsent,
  login,
  logout,
  register,
} from './auth-api';
import { getSession, setSession } from '@/shared/auth-session/session-store';

const fetchMock = vi.fn<typeof fetch>();

function bodyOf(call: Parameters<typeof fetch>): unknown {
  return JSON.parse(String(call[1]?.body));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('auth api', () => {
  it('[TC-01-03] register posts credentials and starts the session', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(authResponse('reg-token'), 201),
    );

    await register({ email: 'anna@example.com', password: 'password-1' });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('/api/auth/register');
    expect(call[1]).toMatchObject({ method: 'POST' });
    expect(bodyOf(call)).toEqual({
      email: 'anna@example.com',
      password: 'password-1',
    });
    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'reg-token',
    });
  });

  it('[TC-01-03] register surfaces EMAIL_TAKEN without starting a session', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(409, ERROR_CODES.EMAIL_TAKEN),
    );

    await expect(
      register({ email: 'a@b.co', password: 'password-1' }),
    ).rejects.toMatchObject({
      status: 409,
      code: ERROR_CODES.EMAIL_TAKEN,
    });

    expect(getSession().status).toBe('unknown');
  });

  it('[TC-01-03] login starts the session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse('login-token')));

    await login({ email: 'anna@example.com', password: 'password-1' });

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/login');
    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'login-token',
    });
  });

  it('[TC-01-05] login 401 rejects with INVALID_CREDENTIALS and does not try to refresh', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(401, ERROR_CODES.INVALID_CREDENTIALS),
    );

    await expect(
      login({ email: 'a@b.co', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-03] logout posts to the logout endpoint and clears the session', async () => {
    setSession(authResponse());
    fetchMock.mockResolvedValueOnce(emptyResponse());

    await logout();

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/logout');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-03] logout keeps the session and rejects when the request fails on the network', async () => {
    setSession(authResponse('tok'));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(logout()).rejects.toThrow('Failed to fetch');

    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'tok',
    });
  });

  it('[TC-01-03] logout keeps the session and rejects on a server error', async () => {
    setSession(authResponse('tok'));
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'INTERNAL_ERROR'));

    await expect(logout()).rejects.toMatchObject({ status: 500 });

    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'tok',
    });
  });

  it.each([401, 404])(
    '[TC-01-03] logout clears the session when the server answers %i',
    async (status) => {
      setSession(authResponse());
      fetchMock.mockResolvedValueOnce(errorResponse(status, 'ANY_CODE'));

      await expect(logout()).resolves.toBeUndefined();

      expect(getSession()).toEqual({
        status: 'anonymous',
        accessToken: null,
        user: null,
      });
    },
  );

  it('[TC-01-03] grantConsent posts with the Bearer token and updates the user', async () => {
    setSession(authResponse('tok'));
    const consented = { ...TEST_USER, consentAt: '2026-11-13T10:00:00.000Z' };
    fetchMock.mockResolvedValueOnce(jsonResponse(consented));

    await grantConsent();

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('/api/me/consent');
    expect(call[1]).toMatchObject({ method: 'POST' });
    expect(new Headers(call[1]?.headers).get('Authorization')).toBe(
      'Bearer tok',
    );
    expect(getSession()).toMatchObject({ accessToken: 'tok', user: consented });
  });

  it('[TC-01-07] getConsentInfo returns the providers', async () => {
    setSession(authResponse());
    const info = {
      consentAt: null,
      providers: { stt: 'deepgram', llm: 'gemini' },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(info));

    await expect(getConsentInfo()).resolves.toEqual(info);

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/me/consent');
  });

  it('[TC-01-02] deleteAccount sends the password and clears the session', async () => {
    setSession(authResponse());
    fetchMock.mockResolvedValueOnce(emptyResponse());

    await deleteAccount('password-1');

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('/api/me');
    expect(call[1]).toMatchObject({ method: 'DELETE' });
    expect(bodyOf(call)).toEqual({ password: 'password-1' });
    expect(getSession().status).toBe('anonymous');
  });

  it('[TC-01-02] deleteAccount with a wrong password rejects without a refresh and keeps the session', async () => {
    setSession(authResponse());
    fetchMock.mockResolvedValueOnce(
      errorResponse(403, ERROR_CODES.INVALID_PASSWORD),
    );

    await expect(deleteAccount('nope')).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.INVALID_PASSWORD,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSession().status).toBe('authenticated');
  });
});
