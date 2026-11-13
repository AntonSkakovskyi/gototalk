import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import { sessionErrorKey } from './session-errors';

describe('sessionErrorKey', () => {
  it('[TC-03-03] maps a missing consent', () => {
    const error = new ApiError(403, ERROR_CODES.CONSENT_REQUIRED, 'consent');

    expect(sessionErrorKey(error)).toEqual({
      key: 'session.errors.consentRequired',
    });
  });

  it('[TC-03-03] maps an invalid model response', () => {
    const error = new ApiError(
      502,
      ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      'bad plan',
    );

    expect(sessionErrorKey(error)).toEqual({
      key: 'session.errors.planUnavailable',
    });
  });

  it('[TC-03-03] maps a missing session', () => {
    const error = new ApiError(404, ERROR_CODES.SESSION_NOT_FOUND, 'missing');

    expect(sessionErrorKey(error)).toEqual({ key: 'session.errors.notFound' });
  });

  it('[TC-03-03] falls back to the generic key for other errors', () => {
    expect(sessionErrorKey(new ApiError(500, 'UNKNOWN_ERROR', 'boom'))).toEqual(
      { key: 'errors.generic' },
    );
    expect(sessionErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
  });

  it.each([
    new ApiError(403, ERROR_CODES.CONSENT_REQUIRED, 'consent'),
    new ApiError(502, ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE, 'bad plan'),
    new ApiError(404, ERROR_CODES.SESSION_NOT_FOUND, 'missing'),
    new ApiError(500, 'UNKNOWN_ERROR', 'boom'),
  ])('[TC-03-03] returns a key present in uk.json for %s', (error) => {
    const { key } = sessionErrorKey(error);

    expect(i18n.exists(key)).toBe(true);
  });
});
