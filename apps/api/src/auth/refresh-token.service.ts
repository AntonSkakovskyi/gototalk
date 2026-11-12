import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  InvalidRefreshTokenError,
  TokenReusedError,
} from './refresh-token.errors.js';
import {
  REFRESH_TOKENS_REPOSITORY,
  type RefreshTokensRepository,
} from './refresh-tokens.repository.js';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const CLOCK = Symbol('CLOCK');

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(REFRESH_TOKENS_REPOSITORY)
    private readonly repository: RefreshTokensRepository,
    @Optional()
    @Inject(CLOCK)
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const fresh = this.generate();
    await this.repository.insert({
      userId,
      tokenHash: fresh.tokenHash,
      expiresAt: fresh.expiresAt,
    });
    return { token: fresh.token, expiresAt: fresh.expiresAt };
  }

  async rotate(rawToken: string): Promise<RotatedRefreshToken> {
    const now = this.now();
    const fresh = this.generate(now);
    const oldTokenHash = hashToken(rawToken);
    const rotated = await this.repository.rotateActive(
      oldTokenHash,
      { tokenHash: fresh.tokenHash, expiresAt: fresh.expiresAt },
      now,
    );
    if (rotated) {
      return {
        userId: rotated.userId,
        token: fresh.token,
        expiresAt: fresh.expiresAt,
      };
    }

    const existing = await this.repository.findByHash(oldTokenHash);
    if (existing?.revokedAt) {
      await this.repository.revokeAllForUser(existing.userId, now);
      throw new TokenReusedError();
    }
    throw new InvalidRefreshTokenError();
  }

  async revoke(rawToken: string): Promise<void> {
    await this.repository.revokeActiveByHash(hashToken(rawToken), this.now());
  }

  private generate(now: Date = this.now()) {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    };
  }
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
