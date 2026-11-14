import { getSession } from '@/shared/session/session-store';
import { refreshSession } from './refresh';
import { toApiError } from './api-error';

export { ApiError } from './api-error';

interface Parser<T> {
  parse(data: unknown): T;
}

export interface ApiFetchOptions<T = unknown> {
  method?: string;
  body?: unknown;
  schema?: Parser<T>;
  /** Set to false for endpoints that must not carry a token or trigger a refresh (login, register, logout). */
  auth?: boolean;
}

async function send(
  path: string,
  { method = 'GET', body, auth = true }: ApiFetchOptions,
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers();
  const isForm = body instanceof FormData;
  // The browser sets the multipart content type with its boundary.
  if (body !== undefined && !isForm) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: isForm || body === undefined ? body : JSON.stringify(body),
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions<T> = {},
): Promise<T> {
  const sentToken = getSession().accessToken;
  let response = await send(path, options, sentToken);

  if (response.status === 401 && options.auth !== false) {
    const original = await toApiError(response);
    // Another request may already have replaced the token this one was sent with.
    const stale = getSession().accessToken !== sentToken;
    if (!stale && !(await refreshSession())) {
      throw original;
    }
    response = await send(path, options, getSession().accessToken);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json();
  return options.schema ? options.schema.parse(data) : (data as T);
}
