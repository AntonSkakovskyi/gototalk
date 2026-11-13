import 'reflect-metadata';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from './profile.service.js';
import { ProfileOwnerMissingError } from './persistence/profiles.repository.js';
import type {
  ProfileRecord,
  ProfilesRepository,
} from './persistence/profiles.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RECORD: ProfileRecord = {
  level: 'B1',
  scenes: ['travel', 'small_talk'],
  updatedAt: new Date('2026-11-13T10:00:00.123Z'),
};

function setup(overrides: Partial<Record<'findByUserId' | 'upsert', unknown>>) {
  const repository = {
    findByUserId: vi.fn().mockResolvedValue(RECORD),
    upsert: vi.fn().mockResolvedValue(RECORD),
    ...overrides,
  };
  const service = new ProfileService(
    repository as unknown as ProfilesRepository,
  );
  return { service, repository };
}

describe('ProfileService.get', () => {
  it('[TC-02-01] returns the profile with an ISO updatedAt', async () => {
    const { service, repository } = setup({});

    await expect(service.get(USER_ID)).resolves.toEqual({
      level: 'B1',
      scenes: ['travel', 'small_talk'],
      updatedAt: '2026-11-13T10:00:00.123Z',
    });
    expect(repository.findByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('[TC-02-02] a missing profile gives 404 PROFILE_NOT_FOUND', async () => {
    const { service } = setup({
      findByUserId: vi.fn().mockResolvedValue(null),
    });

    const failure = await service.get(USER_ID).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(NotFoundException);
    expect((failure as NotFoundException).getResponse()).toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('ProfileService.update', () => {
  it('[TC-02-01] upserts level and scenes for the user and returns the profile', async () => {
    const { service, repository } = setup({});

    const profile = await service.update(USER_ID, {
      level: 'B1',
      scenes: ['travel', 'small_talk'],
    });

    expect(repository.upsert).toHaveBeenCalledWith(USER_ID, {
      level: 'B1',
      scenes: ['travel', 'small_talk'],
    });
    expect(profile.updatedAt).toBe('2026-11-13T10:00:00.123Z');
  });

  it('[TC-02-02] a user that no longer exists gives 401 UnauthorizedException', async () => {
    const { service } = setup({
      upsert: vi.fn().mockRejectedValue(new ProfileOwnerMissingError()),
    });

    await expect(
      service.update(USER_ID, { level: 'A2', scenes: ['travel'] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('[TC-02-01] other repository failures are not swallowed', async () => {
    const failure = new Error('connection lost');
    const { service } = setup({
      upsert: vi.fn().mockRejectedValue(failure),
    });

    await expect(
      service.update(USER_ID, { level: 'A2', scenes: ['travel'] }),
    ).rejects.toBe(failure);
  });
});
