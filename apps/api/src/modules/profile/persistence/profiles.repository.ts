import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { LevelSchema } from '@gototalk/shared';
import type { Level, UpdateProfileRequest } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { isForeignKeyViolation } from '../../../core/db/pg-errors.js';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import { profiles } from '../../../core/db/schema.js';

export interface ProfileRecord {
  level: Level;
  scenes: string[];
  updatedAt: Date;
}

export class ProfileOwnerMissingError extends Error {
  constructor() {
    super('The profile owner does not exist');
    this.name = 'ProfileOwnerMissingError';
  }
}

type ProfileRow = typeof profiles.$inferSelect;

function toRecord(row: ProfileRow): ProfileRecord {
  return {
    level: LevelSchema.parse(row.level),
    scenes: row.scenes,
    updatedAt: pgTimestampToDate(row.updatedAt),
  };
}

@Injectable()
export class ProfilesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const [row] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async upsert(
    userId: string,
    { level, scenes }: UpdateProfileRequest,
  ): Promise<ProfileRecord> {
    try {
      const [row] = await this.db
        .insert(profiles)
        .values({ userId, level, scenes })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { level, scenes, updatedAt: sql`now()` },
        })
        .returning();
      if (!row) throw new Error('Upsert returned no row');
      return toRecord(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new ProfileOwnerMissingError();
      throw error;
    }
  }
}
