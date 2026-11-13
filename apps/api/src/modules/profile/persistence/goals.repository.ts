import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { GoalStatusSchema } from '@gototalk/shared';
import type { GoalStatus, UpdateGoalRequest } from '@gototalk/shared';
import { DRIZZLE } from '../../../core/db/db.tokens.js';
import type { Database } from '../../../core/db/db.tokens.js';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import { goals, users } from '../../../core/db/schema.js';

export interface GoalRecord {
  id: string;
  title: string;
  status: GoalStatus;
  createdAt: Date;
}

export class GoalsOwnerMissingError extends Error {
  constructor() {
    super('The goals owner does not exist');
    this.name = 'GoalsOwnerMissingError';
  }
}

export interface GoalsUnitOfWork {
  countActive(userId: string): Promise<number>;
  find(userId: string, id: string): Promise<GoalRecord | null>;
  insert(userId: string, title: string): Promise<GoalRecord>;
  update(
    userId: string,
    id: string,
    patch: UpdateGoalRequest,
  ): Promise<GoalRecord | null>;
}

type GoalRow = typeof goals.$inferSelect;
type Executor = Pick<Database, 'select' | 'insert' | 'update'>;

function toRecord(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    title: row.title,
    status: GoalStatusSchema.parse(row.status),
    createdAt: pgTimestampToDate(row.createdAt),
  };
}

function unitOfWork(executor: Executor): GoalsUnitOfWork {
  return {
    async countActive(userId) {
      const [row] = await executor
        .select({ total: count() })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, 'active')));
      return row?.total ?? 0;
    },
    async find(userId, id) {
      const [row] = await executor
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .limit(1);
      return row ? toRecord(row) : null;
    },
    async insert(userId, title) {
      const [row] = await executor
        .insert(goals)
        .values({ userId, title })
        .returning();
      if (!row) throw new Error('Insert returned no row');
      return toRecord(row);
    },
    async update(userId, id, { title, status }) {
      const [row] = await executor
        .update(goals)
        .set({ title, status })
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .returning();
      return row ? toRecord(row) : null;
    },
  };
}

@Injectable()
export class GoalsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string): Promise<GoalRecord[]> {
    const rows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(asc(goals.createdAt), asc(goals.id));
    return rows.map(toRecord);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return rows.length > 0;
  }

  withLockedUser<T>(
    userId: string,
    work: (unit: GoalsUnitOfWork) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      // Lock serialises one user's goal writes so the active limit cannot be raced
      const locked = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('no key update');
      if (locked.length === 0) throw new GoalsOwnerMissingError();
      return work(unitOfWork(tx));
    });
  }
}
