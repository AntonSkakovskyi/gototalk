import { z } from 'zod';
import { getSession, setSession } from '@/shared/session/session-store';
import {
  authResponse,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { ApiError, apiFetch } from './http';

const fetchMock = vi.fn<typeof fetch>();

function callsTo(url: string) {
  return fetchMock.mock.calls.filter(([target]) => target === url);
}

function authorizationOf(call: Parameters<typeof fetch>): string | null {
  return new Headers(call[1]?.headers).get('Authorization');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setSession(authResponse('token-1'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('[TC-01-03] adds the Bearer token and same-origin credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/thing');

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('/api/thing');
    expect(authorizationOf(call)).toBe('Bearer token-1');
    expect(call[1]).toMatchObject({ credentials: 'same-origin' });
  });

  it('[TC-01-03] sends a JSON body with a content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/thing', { method: 'POST', body: { a: 1 } });

    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('[TC-04-05] sends FormData as is without a content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const form = new FormData();
    form.append('audio', new Blob(['a'], { type: 'audio/webm' }), 'a.webm');

    await apiFetch('/api/thing', { method: 'POST', body: form });

    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe(form);
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('[TC-04-05] resends the same FormData on the retry after a refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonResponse(authResponse('token-2')))
      .mockResolvedValueOnce(jsonResponse({}));
    const form = new FormData();
    form.append('audio', new Blob(['a'], { type: 'audio/webm' }), 'a.webm');

    await apiFetch('/api/thing', { method: 'POST', body: form });

    const calls = callsTo('/api/thing');
    expect(calls).toHaveLength(2);
    expect(calls[1]![1]!.body).toBe(form);
    expect(new Headers(calls[1]![1]!.headers).has('Content-Type')).toBe(false);
    expect(authorizationOf(calls[1]!)).toBe('Bearer token-2');
  });

  it('[TC-01-03] does not send a Bearer token or retry when auth is disabled', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'INVALID_CREDENTIALS'));

    await expect(
      apiFetch('/api/auth/login', { method: 'POST', auth: false }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });

    expect(authorizationOf(fetchMock.mock.calls[0]!)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSession().status).toBe('authenticated');
  });

  it('[TC-01-03] returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());

    await expect(
      apiFetch('/api/thing', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('[TC-01-03] validates the body with the given schema', async () => {
    const schema = z.object({ n: z.number() });
    fetchMock.mockResolvedValueOnce(jsonResponse({ n: 1 }));

    await expect(apiFetch('/api/thing', { schema })).resolves.toEqual({ n: 1 });

    fetchMock.mockResolvedValueOnce(jsonResponse({ n: 'x' }));

    await expect(apiFetch('/api/thing', { schema })).rejects.toThrow();
  });

  it('[TC-01-03] a 401 triggers exactly one refresh and a retry with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonResponse(authResponse('token-2')))
      .mockResolvedValueOnce(jsonResponse({ n: 1 }));

    const result = await apiFetch('/api/thing', {
      schema: z.object({ n: z.number() }),
    });

    expect(result).toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callsTo('/api/auth/refresh')).toHaveLength(1);
    const thingCalls = callsTo('/api/thing');
    expect(authorizationOf(thingCalls[0]!)).toBe('Bearer token-1');
    expect(authorizationOf(thingCalls[1]!)).toBe('Bearer token-2');
  });

  it('[TC-01-03] resends the JSON body on the retry', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonResponse(authResponse('token-2')))
      .mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/thing', { method: 'POST', body: { a: 1 } });

    expect(callsTo('/api/thing')[1]![1]!.body).toBe('{"a":1}');
  });

  it('[TC-01-03] two parallel 401s result in one refresh request', async () => {
    fetchMock.mockImplementation((url, init) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(jsonResponse(authResponse('token-2')));
      }
      const bearer = new Headers(init?.headers).get('Authorization');
      return Promise.resolve(
        bearer === 'Bearer token-2'
          ? jsonResponse({ ok: true })
          : errorResponse(401, 'UNAUTHORIZED'),
      );
    });

    await Promise.all([apiFetch('/api/a'), apiFetch('/api/b')]);

    expect(callsTo('/api/auth/refresh')).toHaveLength(1);
    expect(callsTo('/api/a')).toHaveLength(2);
    expect(callsTo('/api/b')).toHaveLength(2);
  });

  it('[TC-01-03] a late 401 for an already replaced token retries without another refresh', async () => {
    let releaseLate: (response: Response) => void = () => {};
    fetchMock.mockImplementation((url, init) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(jsonResponse(authResponse('token-2')));
      }
      const bearer = new Headers(init?.headers).get('Authorization');
      if (bearer === 'Bearer token-2') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (url === '/api/a') {
        return Promise.resolve(errorResponse(401, 'UNAUTHORIZED'));
      }
      return new Promise<Response>((resolve) => {
        releaseLate = resolve;
      });
    });

    const first = apiFetch('/api/a');
    const late = apiFetch('/api/b');

    await first;
    expect(getSession().accessToken).toBe('token-2');
    releaseLate(errorResponse(401, 'UNAUTHORIZED'));
    await late;

    expect(callsTo('/api/auth/refresh')).toHaveLength(1);
    expect(callsTo('/api/b')).toHaveLength(2);
  });

  it('[TC-01-03] a failed refresh sets anonymous and rejects with the original ApiError', async () => {
    fetchMock
      .mockResolvedValueOnce(
        errorResponse(401, 'UNAUTHORIZED', 'Token expired'),
      )
      .mockResolvedValueOnce(
        errorResponse(401, 'UNAUTHORIZED', 'No refresh cookie'),
      );

    const error = await apiFetch('/api/thing').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token expired',
    });
    expect(getSession().status).toBe('anonymous');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('[TC-01-03] a 5xx on refresh does not clear the session', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(errorResponse(503, 'SERVICE_UNAVAILABLE'));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 503 });

    expect(getSession()).toMatchObject({
      status: 'authenticated',
      accessToken: 'token-1',
    });
  });

  it('[TC-01-03] retries only once when the retried request is also 401', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonResponse(authResponse('token-2')))
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getSession().status).toBe('authenticated');
  });

  it('[TC-01-03] ApiError carries status, code and message from the error body', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(403, 'CONSENT_REQUIRED', 'Consent required'),
    );

    const error = await apiFetch('/api/thing').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: 'CONSENT_REQUIRED',
      message: 'Consent required',
    });
  });

  it('[TC-01-03] ApiError falls back to a generic code for a non-JSON error body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad gateway</html>', { status: 502 }),
    );

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
    });
  });

  it('[TC-01-03] never writes the token to web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonResponse(authResponse('token-2')))
      .mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/thing');

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
