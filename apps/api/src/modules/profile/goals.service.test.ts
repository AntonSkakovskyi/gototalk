import 'reflect-metadata';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { GoalsService } from './goals.service.js';
import { GoalsOwnerMissingError } from './persistence/goals.repository.js';
import type {
  GoalRecord,
  GoalsRepository,
  GoalsUnitOfWork,
} from './persistence/goals.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GOAL_ID = '22222222-2222-4222-8222-222222222222';
const ACTIVE: GoalRecord = {
  id: GOAL_ID,
  title: 'Speak at meetings',
  status: 'active',
  createdAt: new Date('2026-11-13T10:00:00.123Z'),
};
const DONE: GoalRecord = { ...ACTIVE, status: 'done' };

function setup(
  unit: Partial<Record<keyof GoalsUnitOfWork, unknown>> = {},
  repository: Partial<
    Record<'list' | 'delete' | 'withLockedUser', unknown>
  > = {},
) {
  const tx = {
    countActive: vi.fn().mockResolvedValue(0),
    find: vi.fn().mockResolvedValue(ACTIVE),
    insert: vi.fn().mockResolvedValue(ACTIVE),
    update: vi.fn().mockResolvedValue(ACTIVE),
    ...unit,
  };
  const repo = {
    list: vi.fn().mockResolvedValue([ACTIVE]),
    delete: vi.fn().mockResolvedValue(true),
    withLockedUser: vi.fn(
      (_userId: string, work: (unitOfWork: unknown) => Promise<unknown>) =>
        work(tx),
    ),
    ...repository,
  };
  const service = new GoalsService(repo as unknown as GoalsRepository);
  return { service, repo, tx };
}

function ownerMissing() {
  return {
    withLockedUser: vi.fn().mockRejectedValue(new GoalsOwnerMissingError()),
  };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

function responseOf(failure: unknown): unknown {
  return failure instanceof ConflictException ||
    failure instanceof NotFoundException
    ? failure.getResponse()
    : undefined;
}

describe('GoalsService.list', () => {
  it('[TC-02-01] returns the goals of the user with ISO createdAt', async () => {
    const { service, repo } = setup();

    await expect(service.list(USER_ID)).resolves.toEqual([
      {
        id: GOAL_ID,
        title: 'Speak at meetings',
        status: 'active',
        createdAt: '2026-11-13T10:00:00.123Z',
      },
    ]);
    expect(repo.list).toHaveBeenCalledWith(USER_ID);
  });
});

describe('GoalsService.create', () => {
  it('[TC-02-01] creates a goal while fewer than the maximum are active', async () => {
    const { service, tx } = setup({
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS - 1),
    });

    const goal = await service.create(USER_ID, { title: 'Speak at meetings' });

    expect(tx.insert).toHaveBeenCalledWith(USER_ID, 'Speak at meetings');
    expect(goal).toMatchObject({ id: GOAL_ID, status: 'active' });
  });

  it('[TC-02-01] the 4th active goal gives 409 ACTIVE_GOALS_LIMIT', async () => {
    const { service, tx } = setup({
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS),
    });

    const failure = await failureOf(service.create(USER_ID, { title: 'More' }));

    expect(failure).toBeInstanceOf(ConflictException);
    expect(responseOf(failure)).toMatchObject({
      code: 'ACTIVE_GOALS_LIMIT',
      message: 'You can have at most 3 active goals',
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('[TC-02-01] a user that no longer exists gives 401 UnauthorizedException', async () => {
    const { service } = setup({}, ownerMissing());

    await expect(
      service.create(USER_ID, { title: 'Goal' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('[TC-02-01] other repository failures are not swallowed', async () => {
    const failure = new Error('connection lost');
    const { service } = setup({ insert: vi.fn().mockRejectedValue(failure) });

    await expect(service.create(USER_ID, { title: 'Goal' })).rejects.toBe(
      failure,
    );
  });
});

describe('GoalsService.update', () => {
  it('[TC-02-01] reactivating a done goal with 3 active gives 409 ACTIVE_GOALS_LIMIT', async () => {
    const { service, tx } = setup({
      find: vi.fn().mockResolvedValue(DONE),
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS),
    });

    const failure = await failureOf(
      service.update(USER_ID, GOAL_ID, { status: 'active' }),
    );

    expect(failure).toBeInstanceOf(ConflictException);
    expect(responseOf(failure)).toMatchObject({ code: 'ACTIVE_GOALS_LIMIT' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('[TC-02-01] reactivating a done goal with a free slot succeeds', async () => {
    const { service, tx } = setup({
      find: vi.fn().mockResolvedValue(DONE),
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS - 1),
    });

    await service.update(USER_ID, GOAL_ID, { status: 'active' });

    expect(tx.update).toHaveBeenCalledWith(USER_ID, GOAL_ID, {
      status: 'active',
    });
  });

  it('[TC-02-01] an active goal that stays active is fine with 3 active', async () => {
    const { service, tx } = setup({
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS),
    });

    await service.update(USER_ID, GOAL_ID, { status: 'active', title: 'New' });

    expect(tx.countActive).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledOnce();
  });

  it('[TC-02-01] changing only the title or marking done skips the limit check', async () => {
    const { service, tx } = setup({
      find: vi.fn().mockResolvedValue(DONE),
      countActive: vi.fn().mockResolvedValue(MAX_ACTIVE_GOALS),
    });

    await service.update(USER_ID, GOAL_ID, { title: 'Renamed' });
    await service.update(USER_ID, GOAL_ID, { status: 'done' });

    expect(tx.countActive).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it('[TC-02-01] a missing goal gives 404 GOAL_NOT_FOUND', async () => {
    const { service, tx } = setup({ find: vi.fn().mockResolvedValue(null) });

    const failure = await failureOf(
      service.update(USER_ID, GOAL_ID, { title: 'x' }),
    );

    expect(failure).toBeInstanceOf(NotFoundException);
    expect(responseOf(failure)).toMatchObject({ code: 'GOAL_NOT_FOUND' });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('[TC-02-01] a goal deleted between lookup and update gives 404 GOAL_NOT_FOUND', async () => {
    const { service } = setup({ update: vi.fn().mockResolvedValue(null) });

    const failure = await failureOf(
      service.update(USER_ID, GOAL_ID, { title: 'x' }),
    );

    expect(responseOf(failure)).toMatchObject({ code: 'GOAL_NOT_FOUND' });
  });

  it('[TC-02-01] an id that is not a uuid gives 404 GOAL_NOT_FOUND without a query', async () => {
    const { service, repo } = setup();

    const failure = await failureOf(
      service.update(USER_ID, 'not-a-uuid', { title: 'x' }),
    );

    expect(responseOf(failure)).toMatchObject({ code: 'GOAL_NOT_FOUND' });
    expect(repo.withLockedUser).not.toHaveBeenCalled();
  });

  it('[TC-02-01] a user that no longer exists gives 401 UnauthorizedException', async () => {
    const { service } = setup({}, ownerMissing());

    await expect(
      service.update(USER_ID, GOAL_ID, { title: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('GoalsService.remove', () => {
  it('[TC-02-01] deletes the goal of the user', async () => {
    const { service, repo } = setup();

    await service.remove(USER_ID, GOAL_ID);

    expect(repo.delete).toHaveBeenCalledWith(USER_ID, GOAL_ID);
  });

  it('[TC-02-01] a missing goal gives 404 GOAL_NOT_FOUND', async () => {
    const { service } = setup({}, { delete: vi.fn().mockResolvedValue(false) });

    const failure = await failureOf(service.remove(USER_ID, GOAL_ID));

    expect(failure).toBeInstanceOf(NotFoundException);
    expect(responseOf(failure)).toMatchObject({ code: 'GOAL_NOT_FOUND' });
  });

  it('[TC-02-01] an id that is not a uuid gives 404 GOAL_NOT_FOUND without a query', async () => {
    const { service, repo } = setup();

    const failure = await failureOf(service.remove(USER_ID, 'not-a-uuid'));

    expect(responseOf(failure)).toMatchObject({ code: 'GOAL_NOT_FOUND' });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
