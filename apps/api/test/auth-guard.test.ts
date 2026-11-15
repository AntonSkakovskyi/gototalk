import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorResponseSchema } from '@gototalk/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CurrentUser } from '../src/modules/auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { ZodBodyPipe } from '../src/common/pipes/zod-body.pipe.js';
import { buildEnv, createTestApp } from './support/test-app.js';

const BodySchema = z.object({ password: z.string().min(20) });

@Controller('test-auth')
class TestAuthController {
  @Get('protected')
  protectedRoute(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Get('open')
  openRoute(): { open: true } {
    return { open: true };
  }

  @Public()
  @Get('cookie')
  cookie(@Req() req: { cookies: Record<string, string> }): {
    value: string | undefined;
  } {
    return { value: req.cookies['gtt_refresh'] };
  }

  @Public()
  @Post('validated')
  validated(@Body(new ZodBodyPipe(BodySchema)) body: { password: string }): {
    password: string;
  } {
    return body;
  }
}

@Public()
@Controller('test-public-class')
class TestPublicClassController {
  @Get()
  open(): { open: true } {
    return { open: true };
  }
}

const SECRET = buildEnv()['JWT_ACCESS_SECRET'] as string;
const USER_ID = '6f1c2a0e-4b8d-4f7e-9a53-0c7d2f1b9e11';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('Authentication guard', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [TestAuthController, TestPublicClassController],
    });
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function expectUnauthorized(authorization?: string): Promise<void> {
    const req = request(app.getHttpServer()).get('/api/test-auth/protected');
    const res = await (authorization
      ? req.set('Authorization', authorization)
      : req);

    expect(res.status).toBe(401);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
  }

  it('[TC-01-04] protected route without a token returns 401 UNAUTHORIZED', async () => {
    await expectUnauthorized();
  });

  it('[TC-01-04] a malformed token returns 401', async () => {
    await expectUnauthorized('Bearer not-a-jwt');
  });

  it('[TC-01-04] a non-Bearer scheme returns 401', async () => {
    const token = await jwt.signAsync({ sub: USER_ID });

    await expectUnauthorized(`Basic ${token}`);
  });

  it('[TC-01-04] an expired token returns 401', async () => {
    const token = await new JwtService({ secret: SECRET }).signAsync({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token signed with a different secret returns 401', async () => {
    const token = await new JwtService({
      secret: 'another-secret-another-secret-another-secret',
    }).signAsync({ sub: USER_ID }, { expiresIn: '15m' });

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token with alg none returns 401', async () => {
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token with the right secret but another algorithm returns 401', async () => {
    const token = await new JwtService({ secret: SECRET }).signAsync(
      { sub: USER_ID },
      { algorithm: 'HS512', expiresIn: '15m' },
    );

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a valid token without a subject returns 401', async () => {
    const token = await jwt.signAsync({});

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token with a numeric subject returns 401', async () => {
    const token = await jwt.signAsync({ sub: 42 });

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token with an empty subject returns 401', async () => {
    const token = await jwt.signAsync({ sub: '' });

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] a token with the right secret but no exp returns 401', async () => {
    const token = await new JwtService({ secret: SECRET }).signAsync({
      sub: USER_ID,
    });

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('[TC-01-04] Bearer with an empty token returns 401', async () => {
    await expectUnauthorized('Bearer ');
  });

  it('[TC-01-04] a class-level Public controller works without a token', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/test-public-class',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ open: true });
  });

  it('[TC-01-04] a valid token returns 200 and CurrentUser carries the id', async () => {
    const token = await jwt.signAsync({ sub: USER_ID });

    const res = await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: USER_ID });
  });

  it('[TC-01-04] a Public route works without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/test-auth/open');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ open: true });
  });

  it('[TC-01-04] /api/health stays open without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
  });

  it('[TC-01-02] cookie-parser exposes request cookies', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test-auth/cookie')
      .set('Cookie', 'gtt_refresh=abc123');

    expect(res.body).toEqual({ value: 'abc123' });
  });

  it('[TC-01-02] ZodBodyPipe: an invalid body returns 400 VALIDATION_ERROR without echoing values', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-auth/validated')
      .send({ password: 'SECRET-VALUE-xyz' });

    expect(res.status).toBe(400);
    const { error } = ErrorResponseSchema.parse(res.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed: password: too_small');
    expect(JSON.stringify(res.body)).not.toContain('SECRET-VALUE-xyz');
  });

  it('[TC-01-02] ZodBodyPipe: a valid body passes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-auth/validated')
      .send({ password: 'a-sufficiently-long-password', extra: 'dropped' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ password: 'a-sufficiently-long-password' });
  });
});
