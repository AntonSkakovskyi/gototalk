import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResponseSchema, ErrorResponseSchema } from '@gototalk/shared';
import request from 'supertest';
import type { Response } from 'supertest';
import { expect } from 'vitest';

const PASSWORD = 'correct-horse-battery';
export const MISSING_USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

export interface RegisteredUser {
  id: string;
  token: string;
}

export async function registerUser(
  app: INestApplication,
): Promise<RegisteredUser> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email: `${randomUUID()}@example.com`, password: PASSWORD });
  const { accessToken, user } = AuthResponseSchema.parse(res.body);
  return { id: user.id, token: accessToken };
}

export async function grantConsent(
  app: INestApplication,
  token: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .post('/api/me/consent')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
}

export async function putProfile(
  app: INestApplication,
  token: string,
  body: object,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .put('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  expect(res.status).toBe(200);
}

export function tokenOfMissingUser(app: INestApplication): Promise<string> {
  return app.get(JwtService).signAsync({ sub: MISSING_USER_ID });
}

export function expectError(res: Response, status: number, code: string): void {
  expect(res.status).toBe(status);
  expect(ErrorResponseSchema.parse(res.body).error.code).toBe(code);
}
