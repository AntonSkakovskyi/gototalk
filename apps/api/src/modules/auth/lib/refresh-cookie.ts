import { GLOBAL_PREFIX } from '../../../configure-app.js';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token.service.js';

export const REFRESH_COOKIE_NAME = 'gtt_refresh';

export interface CookieResponse {
  cookie(name: string, value: string, options: object): unknown;
  clearCookie(name: string, options: object): unknown;
}

export interface CookieRequest {
  cookies?: Record<string, unknown>;
}

const BASE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: `/${GLOBAL_PREFIX}/auth`,
} as const;

export function setRefreshCookie(res: CookieResponse, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: CookieResponse): void {
  res.clearCookie(REFRESH_COOKIE_NAME, BASE_OPTIONS);
}

export function readRefreshCookie(req: CookieRequest): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
