import 'reflect-metadata';
import { ERROR_CODES } from '@gototalk/shared';
import type { Word } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { afterOf } from '../../common/pagination/keyset-page.js';
import type { WordMarkingRepository } from './persistence/word-marking.repository.js';
import type { WordsPageRepository } from './persistence/words-page.repository.js';
import { WordAlreadyActiveError, WordNotFoundError } from './words.errors.js';
import { WordsService } from './words.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const WORD_ID = '22222222-2222-4222-8222-222222222222';
const WORD: Word = {
  id: WORD_ID,
  lemma: 'harvest',
  translationUk: 'урожай',
  state: 'partial',
  source: 'hint',
};

function setup(markState: unknown, listPage: unknown = vi.fn()) {
  return new WordsService(
    { markState } as unknown as WordMarkingRepository,
    { listPage } as unknown as WordsPageRepository,
  );
}

describe('WordsService.mark', () => {
  it('returns the updated word', async () => {
    const markState = vi.fn().mockResolvedValue(WORD);

    await expect(
      setup(markState).mark(USER_ID, WORD_ID, 'partial'),
    ).resolves.toEqual(WORD);

    expect(markState).toHaveBeenCalledWith(USER_ID, WORD_ID, 'partial');
  });

  it('answers not found for a malformed id without touching the repository', async () => {
    const markState = vi.fn();

    const result = setup(markState).mark(USER_ID, 'not-a-uuid', 'new');

    await expect(result).rejects.toBeInstanceOf(WordNotFoundError);
    expect(markState).not.toHaveBeenCalled();
  });

  it('maps a missing word to 404 WORD_NOT_FOUND', async () => {
    const markState = vi.fn().mockResolvedValue('not_found');

    const result = setup(markState).mark(USER_ID, WORD_ID, 'new');

    await expect(result).rejects.toMatchObject({
      status: 404,
      response: { code: ERROR_CODES.WORD_NOT_FOUND },
    });
  });

  it('maps an active word to 409 WORD_ALREADY_ACTIVE', async () => {
    const markState = vi.fn().mockResolvedValue('active');

    const result = setup(markState).mark(USER_ID, WORD_ID, 'passive');

    await expect(result).rejects.toBeInstanceOf(WordAlreadyActiveError);
    await expect(result).rejects.toMatchObject({
      status: 409,
      response: { code: ERROR_CODES.WORD_ALREADY_ACTIVE },
    });
  });
});

describe('WordsService.list', () => {
  it('passes the decoded cursor and limit on and encodes the next position', async () => {
    const next = { t: '2026-01-01 10:00:00.000001+00', id: WORD_ID };
    const listPage = vi.fn().mockResolvedValue({ items: [WORD], next });
    const after = { t: '2026-02-01 10:00:00+00', id: USER_ID };
    const cursor = Buffer.from(JSON.stringify(after)).toString('base64url');

    const page = await setup(vi.fn(), listPage).list(USER_ID, {
      cursor,
      limit: 5,
    });

    expect(listPage).toHaveBeenCalledWith(USER_ID, { after, limit: 5 });
    expect(page.items).toEqual([WORD]);
    expect(afterOf(page.nextCursor ?? undefined)).toEqual(next);
  });

  it('returns a null cursor on the last page', async () => {
    const listPage = vi.fn().mockResolvedValue({ items: [], next: null });

    await expect(
      setup(vi.fn(), listPage).list(USER_ID, { limit: 5 }),
    ).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(listPage).toHaveBeenCalledWith(USER_ID, {
      after: undefined,
      limit: 5,
    });
  });
});
