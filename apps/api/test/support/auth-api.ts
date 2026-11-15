import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';

export const COOKIE_NAME = 'gtt_refresh';
export const PASSWORD = 'correct-horse-battery';
export const CLEARED_COOKIE = new RegExp(`${COOKIE_NAME}=;.*Path=/api/auth`);

interface ParsedCookie {
  value: string;
  attributes: string[];
}

export function setCookieHeaders(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
}

export function parseRefreshCookie(res: request.Response): ParsedCookie {
  const raw = setCookieHeaders(res).find((c) =>
    c.startsWith(`${COOKIE_NAME}=`),
  );
  if (!raw) throw new Error('No refresh cookie in the response');
  const [pair = '', ...attributes] = raw.split('; ');
  return { value: pair.slice(COOKIE_NAME.length + 1), attributes };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const newEmail = () => `${randomUUID()}@example.com`;

export function createAuthClient(
  getApp: () => INestApplication,
  getPool: () => pg.Pool,
) {
  async function register(email = newEmail(), password = PASSWORD) {
    const res = await request(getApp().getHttpServer())
      .post('/api/auth/register')
      .send({ email, password });
    return { email, res };
  }

  function login(email: string, password = PASSWORD) {
    return request(getApp().getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  function post(path: string, cookieValue?: string) {
    const req = request(getApp().getHttpServer()).post(path);
    return cookieValue === undefined
      ? req
      : req.set('Cookie', `${COOKIE_NAME}=${cookieValue}`);
  }

  const refresh = (cookieValue?: string) =>
    post('/api/auth/refresh', cookieValue);
  const logout = (cookieValue?: string) =>
    post('/api/auth/logout', cookieValue);

  async function tokenRows(email: string) {
    const { rows } = await getPool().query<{
      token_hash: string;
      revoked_at: Date | null;
    }>(
      `SELECT rt.token_hash, rt.revoked_at FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id WHERE u.email = $1`,
      [email],
    );
    return rows;
  }

  return { register, login, refresh, logout, tokenRows };
}
