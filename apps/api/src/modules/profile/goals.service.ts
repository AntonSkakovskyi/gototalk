import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ERROR_CODES, GoalSchema, MAX_ACTIVE_GOALS } from '@gototalk/shared';
import type {
  CreateGoalRequest,
  Goal,
  UpdateGoalRequest,
} from '@gototalk/shared';
import {
  GoalsOwnerMissingError,
  GoalsRepository,
} from './persistence/goals.repository.js';
import type {
  GoalRecord,
  GoalsUnitOfWork,
} from './persistence/goals.repository.js';

function toGoal(record: GoalRecord): Goal {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

function goalNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.GOAL_NOT_FOUND,
    message: 'The goal was not found',
  });
}

function requireGoalId(id: string): string {
  if (!GoalSchema.shape.id.safeParse(id).success) throw goalNotFound();
  return id;
}

async function assertFreeSlot(
  unit: GoalsUnitOfWork,
  userId: string,
): Promise<void> {
  if ((await unit.countActive(userId)) >= MAX_ACTIVE_GOALS) {
    throw new ConflictException({
      code: ERROR_CODES.ACTIVE_GOALS_LIMIT,
      message: `You can have at most ${MAX_ACTIVE_GOALS} active goals`,
    });
  }
}

@Injectable()
export class GoalsService {
  constructor(private readonly goals: GoalsRepository) {}

  async list(userId: string): Promise<Goal[]> {
    return (await this.goals.list(userId)).map(toGoal);
  }

  async create(userId: string, { title }: CreateGoalRequest): Promise<Goal> {
    const record = await this.withLockedUser(userId, async (unit) => {
      await assertFreeSlot(unit, userId);
      return unit.insert(userId, title);
    });
    return toGoal(record);
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateGoalRequest,
  ): Promise<Goal> {
    const goalId = requireGoalId(id);
    const record = await this.withLockedUser(userId, async (unit) => {
      const current = await unit.find(userId, goalId);
      if (!current) throw goalNotFound();
      if (patch.status === 'active' && current.status !== 'active') {
        await assertFreeSlot(unit, userId);
      }
      const updated = await unit.update(userId, goalId, patch);
      if (!updated) throw goalNotFound();
      return updated;
    });
    return toGoal(record);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.goals.delete(userId, requireGoalId(id)))) {
      throw goalNotFound();
    }
  }

  private async withLockedUser<T>(
    userId: string,
    work: (unit: GoalsUnitOfWork) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.goals.withLockedUser(userId, work);
    } catch (error) {
      if (error instanceof GoalsOwnerMissingError) {
        throw new UnauthorizedException('User no longer exists');
      }
      throw error;
    }
  }
}
