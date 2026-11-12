import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { PasswordHasher } from './password-hasher.js';
import type { RefreshTokenService } from './refresh-token.service.js';
import type { UserRecord, UsersRepository } from './users.repository.js';

const USER: UserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  passwordHash: 'stored-hash',
  consentAt: null,
};

function setup(user: UserRecord | null, passwordMatches = true) {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(user),
  };
  const hasher = {
    verify: vi.fn().mockResolvedValue(passwordMatches),
    verifyDummy: vi.fn().mockResolvedValue(false),
  };
  const refreshTokens = {
    issue: vi
      .fn()
      .mockResolvedValue({ token: 'raw-token', expiresAt: new Date() }),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('access-jwt') };
  const service = new AuthService(
    users as unknown as UsersRepository,
    hasher as unknown as PasswordHasher,
    refreshTokens as unknown as RefreshTokenService,
    jwt as unknown as JwtService,
  );
  return { service, hasher, refreshTokens };
}

const CREDENTIALS = { email: 'user@example.com', password: 'whatever-pass' };

describe('AuthService.login', () => {
  it('[TC-01-05] an unknown email runs verifyDummy, not verify, and gives INVALID_CREDENTIALS', async () => {
    const { service, hasher, refreshTokens } = setup(null);

    const failure = await service.login(CREDENTIALS).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(UnauthorizedException);
    expect((failure as UnauthorizedException).getResponse()).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(hasher.verifyDummy).toHaveBeenCalledWith(CREDENTIALS.password);
    expect(hasher.verify).not.toHaveBeenCalled();
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('[TC-01-05] a known email runs verify against the stored hash, not verifyDummy', async () => {
    const { service, hasher } = setup(USER);

    const session = await service.login(CREDENTIALS);

    expect(hasher.verify).toHaveBeenCalledWith(
      USER.passwordHash,
      CREDENTIALS.password,
    );
    expect(hasher.verifyDummy).not.toHaveBeenCalled();
    expect(session.refreshToken).toBe('raw-token');
    expect(session.response.accessToken).toBe('access-jwt');
  });

  it('[TC-01-05] a wrong password gives the same error as an unknown email', async () => {
    const unknown = setup(null);
    const wrong = setup(USER, false);

    const a = await unknown.service.login(CREDENTIALS).catch((e: unknown) => e);
    const b = await wrong.service.login(CREDENTIALS).catch((e: unknown) => e);

    expect(wrong.hasher.verify).toHaveBeenCalled();
    expect((b as UnauthorizedException).getResponse()).toEqual(
      (a as UnauthorizedException).getResponse(),
    );
  });
});
