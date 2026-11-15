import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { LearnerModelService } from './learner-model.service.js';
import type { LearnerModelRepository } from './persistence/learner-model.repository.js';
import type { WeakArea } from './learner-model.types.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const AREAS: WeakArea[] = [
  {
    category: 'articles',
    frequency: 4,
    lastSeenAt: new Date('2026-11-13T10:00:00.000Z'),
  },
  { category: 'verb_tense', frequency: 2, lastSeenAt: null },
];

function setup(
  counts: Partial<Record<string, number>> = {},
  areas: WeakArea[] = AREAS,
) {
  const repository = {
    weakAreas: vi.fn().mockResolvedValue(areas),
    wordStateCounts: vi.fn().mockResolvedValue(counts),
  };
  const service = new LearnerModelService(
    repository as unknown as LearnerModelRepository,
  );
  return { service, repository };
}

describe('LearnerModelService.weakAreas', () => {
  it('[TC-02-05] asks for the top 3 patterns by default', async () => {
    const { service, repository } = setup();

    await expect(service.weakAreas(USER_ID)).resolves.toEqual(AREAS);
    expect(repository.weakAreas).toHaveBeenCalledWith(USER_ID, 3);
  });

  it('[TC-02-05] passes an explicit limit through', async () => {
    const { service, repository } = setup();

    await service.weakAreas(USER_ID, 5);

    expect(repository.weakAreas).toHaveBeenCalledWith(USER_ID, 5);
  });
});

describe('LearnerModelService.vocabularyStats', () => {
  it('[TC-02-05] fills the states without words with 0', async () => {
    const { service, repository } = setup({ new: 4, active: 1 });

    await expect(service.vocabularyStats(USER_ID)).resolves.toEqual({
      new: 4,
      partial: 0,
      passive: 0,
      active: 1,
    });
    expect(repository.wordStateCounts).toHaveBeenCalledWith(USER_ID);
  });

  it('[TC-02-05] returns zeros for all four states when there are no words', async () => {
    const { service } = setup({});

    await expect(service.vocabularyStats(USER_ID)).resolves.toEqual({
      new: 0,
      partial: 0,
      passive: 0,
      active: 0,
    });
  });
});

describe('LearnerModelService.snapshot', () => {
  it('[TC-02-05] combines the weak areas for the given limit with the vocabulary stats', async () => {
    const { service, repository } = setup({ passive: 2 });

    await expect(service.snapshot(USER_ID, 5)).resolves.toEqual({
      weakAreas: AREAS,
      vocabulary: { new: 0, partial: 0, passive: 2, active: 0 },
    });
    expect(repository.weakAreas).toHaveBeenCalledWith(USER_ID, 5);
  });
});
