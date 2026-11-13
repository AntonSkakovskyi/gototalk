import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../core/db/db.tokens.js';
import type { Database } from '../core/db/db.tokens.js';
import { pgTimestampToDate } from '../core/db/pg-timestamp.js';
import { refreshTokens } from '../core/db/schema.js';
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokensRepository,
} from './refresh-tokens.repository.js';

type Executor = Pick<Database, 'insert' | 'update'>;

@Injectable()
export class DrizzleRefreshTokensRepository implements RefreshTokensRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async insert(token: NewRefreshToken): Promise<void> {
    await insertToken(this.db, token);
  }

  rotateActive(
    oldTokenHash: string,
    next: Pick<NewRefreshToken, 'tokenHash' | 'expiresAt'>,
    now: Date,
  ): Promise<{ userId: string } | null> {
    return this.db.transaction(async (tx) => {
      const revoked = await revokeActive(tx, oldTokenHash, now);
      if (revoked) {
        await insertToken(tx, { userId: revoked.userId, ...next });
      }
      return revoked;
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row) return null;
    return {
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: pgTimestampToDate(row.expiresAt),
      revokedAt:
        row.revokedAt === null ? null : pgTimestampToDate(row.revokedAt),
    };
  }

  async deleteByHash(tokenHash: string): Promise<void> {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}

async function insertToken(
  executor: Executor,
  token: NewRefreshToken,
): Promise<void> {
  await executor.insert(refreshTokens).values({
    userId: token.userId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt.toISOString(),
  });
}

async function revokeActive(
  executor: Executor,
  tokenHash: string,
  now: Date,
): Promise<{ userId: string } | null> {
  const iso = now.toISOString();
  const [row] = await executor
    .update(refreshTokens)
    .set({ revokedAt: iso })
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, iso),
      ),
    )
    .returning({ userId: refreshTokens.userId });
  return row ?? null;
}
