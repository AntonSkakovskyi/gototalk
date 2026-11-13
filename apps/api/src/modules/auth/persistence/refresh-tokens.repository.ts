export const REFRESH_TOKENS_REPOSITORY = Symbol('REFRESH_TOKENS_REPOSITORY');

export interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenRecord extends NewRefreshToken {
  revokedAt: Date | null;
}

export interface RefreshTokensRepository {
  insert(token: NewRefreshToken): Promise<void>;

  /**
   * Revokes the active token and inserts its replacement atomically
   * (one transaction). Returns null, inserting nothing, when no active token matches.
   * Implementations must use the passed `now`, not SQL now(), so the service clock stays authoritative.
   */
  rotateActive(
    oldTokenHash: string,
    next: Pick<NewRefreshToken, 'tokenHash' | 'expiresAt'>,
    now: Date,
  ): Promise<{ userId: string } | null>;

  /** Timestamps must be mapped to Date: Drizzle returns strings here (mode: 'string'). */
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  deleteByHash(tokenHash: string): Promise<void>;

  deleteAllForUser(userId: string): Promise<void>;
}
