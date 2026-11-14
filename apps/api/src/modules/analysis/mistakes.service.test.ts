import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { MistakeView } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  MistakeNotFoundError,
  MistakeSessionNotFoundError,
} from './mistakes.errors.js';
import { MistakesService } from './mistakes.service.js';
import type { MistakesRepository } from './persistence/mistakes.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const MISTAKE_ID = '44444444-4444-4444-8444-444444444444';
const VIEW: MistakeView = {
  id: MISTAKE_ID,
  start: 10,
  end: 20,
  original: 'I go',
  suggestion: 'I went',
  category: 'verb_tense',
  explanationEn: 'Past tense.',
  translationUk: 'Past tense (uk).',
  isFalse: true,
};

function setup(markFalse: unknown) {
  const repository = { markFalse };
  return new MistakesService(repository as unknown as MistakesRepository);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

function codeOf(error: unknown): unknown {
  return error instanceof NotFoundException
    ? Object(error.getResponse()).code
    : undefined;
}

describe('MistakesService.markFalse', () => {
  it('[TC-04-09] returns the view from the repository', async () => {
    const markFalse = vi.fn().mockResolvedValue(VIEW);

    await expect(
      setup(markFalse).markFalse(USER_ID, SESSION_ID, MISTAKE_ID),
    ).resolves.toEqual(VIEW);
    expect(markFalse).toHaveBeenCalledWith(USER_ID, SESSION_ID, MISTAKE_ID);
  });

  it.each(['not-a-uuid', ''])(
    '[TC-04-09] answers 404 SESSION_NOT_FOUND for the session id %j without a query',
    async (sessionId) => {
      const markFalse = vi.fn();

      const error = await rejection(
        setup(markFalse).markFalse(USER_ID, sessionId, MISTAKE_ID),
      );

      expect(codeOf(error)).toBe(ERROR_CODES.SESSION_NOT_FOUND);
      expect(markFalse).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-09] answers 404 MISTAKE_NOT_FOUND for a non-uuid mistake id without a query', async () => {
    const markFalse = vi.fn();

    const error = await rejection(
      setup(markFalse).markFalse(USER_ID, SESSION_ID, 'nope'),
    );

    expect(codeOf(error)).toBe(ERROR_CODES.MISTAKE_NOT_FOUND);
    expect(markFalse).not.toHaveBeenCalled();
  });

  it.each([
    [new MistakeSessionNotFoundError(), ERROR_CODES.SESSION_NOT_FOUND],
    [new MistakeNotFoundError(), ERROR_CODES.MISTAKE_NOT_FOUND],
  ])('[TC-04-09] maps %s to a 404', async (failure, code) => {
    const markFalse = vi.fn().mockRejectedValue(failure);

    const error = await rejection(
      setup(markFalse).markFalse(USER_ID, SESSION_ID, MISTAKE_ID),
    );

    expect(codeOf(error)).toBe(code);
  });

  it('[TC-04-09] rethrows an unknown error untouched', async () => {
    const outage = new Error('db is down');
    const markFalse = vi.fn().mockRejectedValue(outage);

    expect(
      await rejection(
        setup(markFalse).markFalse(USER_ID, SESSION_ID, MISTAKE_ID),
      ),
    ).toBe(outage);
  });
});
