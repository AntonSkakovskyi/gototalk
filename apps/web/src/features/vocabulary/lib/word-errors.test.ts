import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import { wordErrorKey } from './word-errors';

const MAPPED_CODES = [
  [404, ERROR_CODES.WORD_NOT_FOUND, 'vocabulary.errors.notFound'],
  [409, ERROR_CODES.WORD_ALREADY_ACTIVE, 'vocabulary.errors.alreadyActive'],
] as const;

describe('wordErrorKey', () => {
  it.each(MAPPED_CODES)(
    '[TC-05-05] maps %i %s to %s, present in uk.json',
    (status, code, key) => {
      expect(wordErrorKey(new ApiError(status, code, 'message'))).toEqual({
        key,
      });
      expect(i18n.exists(key)).toBe(true);
    },
  );

  it('[TC-05-05] falls back to the generic key for other errors', () => {
    expect(wordErrorKey(new ApiError(500, 'UNKNOWN_ERROR', 'boom'))).toEqual({
      key: 'errors.generic',
    });
    expect(wordErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
  });
});
