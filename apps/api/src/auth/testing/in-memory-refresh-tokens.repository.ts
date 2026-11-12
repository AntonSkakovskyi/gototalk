import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokensRepository,
} from '../refresh-tokens.repository.js';

export class InMemoryRefreshTokensRepository implements RefreshTokensRepository {
  readonly rows: RefreshTokenRecord[] = [];

  insert(token: NewRefreshToken): Promise<void> {
    this.rows.push({ ...token, revokedAt: null });
    return Promise.resolve();
  }

  revokeActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<{ userId: string } | null> {
    const row = this.rows.find(
      (r) =>
        r.tokenHash === tokenHash &&
        r.revokedAt === null &&
        r.expiresAt.getTime() > now.getTime(),
    );
    if (!row) {
      return Promise.resolve(null);
    }
    row.revokedAt = now;
    return Promise.resolve({ userId: row.userId });
  }

  async rotateActive(
    oldTokenHash: string,
    next: Pick<NewRefreshToken, 'tokenHash' | 'expiresAt'>,
    now: Date,
  ): Promise<{ userId: string } | null> {
    const revoked = await this.revokeActiveByHash(oldTokenHash, now);
    if (revoked) {
      await this.insert({ userId: revoked.userId, ...next });
    }
    return revoked;
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = this.rows.find((r) => r.tokenHash === tokenHash);
    return Promise.resolve(row ? { ...row } : null);
  }

  revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const row of this.rows) {
      if (row.userId === userId && row.revokedAt === null) {
        row.revokedAt = now;
      }
    }
    return Promise.resolve();
  }
}
