import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { isUniqueViolation } from '../../../core/db/pg-errors.js';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import { users } from '../../../core/db/schema.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  consentAt: Date | null;
}

export class EmailTakenError extends Error {
  constructor() {
    super('A user with this email already exists');
    this.name = 'EmailTakenError';
  }
}

type UserRow = typeof users.$inferSelect;

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    consentAt: row.consentAt === null ? null : pgTimestampToDate(row.consentAt),
  };
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async grantConsent(id: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .update(users)
      .set({ consentAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.consentAt)))
      .returning();
    return row ? toRecord(row) : this.findById(id);
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async create(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    try {
      const [row] = await this.db.insert(users).values(input).returning();
      if (!row) throw new Error('Insert returned no row');
      return toRecord(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailTakenError();
      throw error;
    }
  }
}
