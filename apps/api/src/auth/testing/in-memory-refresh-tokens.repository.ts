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

  rotateActive(
    oldTokenHash: string,
    next: Pick<NewRefreshToken, 'tokenHash' | 'expiresAt'>,
    now: Date,
  ): Promise<{ userId: string } | null> {
    const row = this.rows.find(
      (r) =>
        r.tokenHash === oldTokenHash &&
        r.revokedAt === null &&
        r.expiresAt.getTime() > now.getTime(),
    );
    if (!row) {
      return Promise.resolve(null);
    }
    row.revokedAt = now;
    this.rows.push({ userId: row.userId, ...next, revokedAt: null });
    return Promise.resolve({ userId: row.userId });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = this.rows.find((r) => r.tokenHash === tokenHash);
    return Promise.resolve(row ? { ...row } : null);
  }

  deleteByHash(tokenHash: string): Promise<void> {
    this.keep((r) => r.tokenHash !== tokenHash);
    return Promise.resolve();
  }

  deleteAllForUser(userId: string): Promise<void> {
    this.keep((r) => r.userId !== userId);
    return Promise.resolve();
  }

  private keep(predicate: (row: RefreshTokenRecord) => boolean): void {
    const kept = this.rows.filter(predicate);
    this.rows.splice(0, this.rows.length, ...kept);
  }
}
