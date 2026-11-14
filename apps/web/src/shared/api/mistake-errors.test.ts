import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from './http';
import { markMistakeErrorKey } from './mistake-errors';

describe('markMistakeErrorKey', () => {
  it.each([
    [ERROR_CODES.MISTAKE_NOT_FOUND, 'dialogue.errors.mistakeNotFound'],
    [ERROR_CODES.SESSION_NOT_FOUND, 'session.errors.notFound'],
  ])('[TC-04-08] maps %s to its own text', (code, key) => {
    expect(markMistakeErrorKey(new ApiError(404, code, 'message'))).toEqual({
      key,
    });
  });

  it('[TC-04-08] falls back to the generic text for other API errors', () => {
    expect(
      markMistakeErrorKey(
        new ApiError(500, ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE, 'message'),
      ),
    ).toEqual({ key: 'errors.generic' });
  });

  it('[TC-04-08] falls back to the generic text for network failures', () => {
    expect(markMistakeErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
  });
});
