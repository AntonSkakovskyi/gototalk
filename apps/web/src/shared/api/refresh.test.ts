import {
  authResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { logout } from '@/auth/auth-api';
import { refreshSession } from './refresh';
import {
  clearSession,
  getSession,
  setSession,
} from '@/shared/session/session-store';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'locks');
});

function stubLocks() {
  let tail: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, callback: () => Promise<boolean>) => {
    const result = tail.then(callback);
    tail = result.catch(() => undefined);
    return result;
  });
  Object.defineProperty(navigator, 'locks', {
    value: { request },
    configurable: true,
  });
  return request;
}

describe('refreshSession', () => {
  it('[TC-01-03] posts to the refresh endpoint with the cookie and stores the session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse('new-token')));

    await expect(refreshSession()).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'new-token',
    });
  });

  it('[TC-01-03] shares one request between parallel callers', async () => {
    fetchMock.mockResolvedValue(jsonResponse(authResponse('new-token')));

    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-03] starts a new request once the previous one has settled', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(authResponse('t'))),
    );

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('[TC-01-03] a 401 clears the session and resolves false', async () => {
    setSession(authResponse('old-token'));
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'));

    await expect(refreshSession()).resolves.toBe(false);

    expect(getSession()).toEqual({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('[TC-01-03] a 5xx rejects and keeps the current session', async () => {
    setSession(authResponse('old-token'));
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'SERVICE_UNAVAILABLE'));

    await expect(refreshSession()).rejects.toMatchObject({ status: 503 });

    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'old-token',
    });
  });

  it('[TC-01-03] a network failure rejects and keeps the current session', async () => {
    setSession(authResponse('old-token'));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(refreshSession()).rejects.toThrow('Failed to fetch');

    expect(getSession().status).toBe('authenticated');
  });

  it('[TC-01-03] rejects a malformed success body without touching the session', async () => {
    setSession(authResponse('old-token'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: '' }));

    await expect(refreshSession()).rejects.toThrow();

    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'old-token',
    });
  });

  it('[TC-01-03] runs under the cross-tab lock when navigator.locks exists', async () => {
    const request = stubLocks();
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse()));

    await refreshSession();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![0]).toBe('gototalk-refresh');
  });

  it('[TC-01-03] takes the cross-tab lock once for parallel callers', async () => {
    const request = stubLocks();
    fetchMock.mockResolvedValue(jsonResponse(authResponse()));

    await Promise.all([refreshSession(), refreshSession()]);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-03] waits for a lock held elsewhere before sending the request', async () => {
    const request = stubLocks();
    let releaseOtherTab: () => void = () => {};
    void request(
      'gototalk-refresh',
      () =>
        new Promise<boolean>((resolve) => {
          releaseOtherTab = () => resolve(true);
        }),
    );
    fetchMock.mockResolvedValue(jsonResponse(authResponse('new-token')));

    const refreshing = refreshSession();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();

    releaseOtherTab();
    await expect(refreshing).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('[TC-01-03] does not resurrect the session when it is cleared during the request', async () => {
    setSession(authResponse('old-token'));
    let respond: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );

    const refreshing = refreshSession();
    clearSession();
    respond(jsonResponse(authResponse('new-token')));

    await expect(refreshing).resolves.toBe(false);

    expect(getSession()).toEqual({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('[TC-01-03] logout during an in-flight refresh keeps the session anonymous', async () => {
    setSession(authResponse('old-token'));
    let respond: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const refreshing = refreshSession();
    await logout();
    respond(jsonResponse(authResponse('new-token')));
    await refreshing;

    expect(getSession().status).toBe('anonymous');
  });
});
