import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import { reportErrorKey } from './report-errors';

const MAPPED_CODES = [
  [404, ERROR_CODES.SESSION_NOT_FOUND, 'session.errors.notFound'],
  [409, ERROR_CODES.SESSION_NOT_FINISHED, 'report.errors.notFinished'],
  [403, ERROR_CODES.CONSENT_REQUIRED, 'dialogue.errors.consentRequired'],
] as const;

describe('reportErrorKey', () => {
  it.each(MAPPED_CODES)(
    '[TC-05-03] maps %i %s to %s, present in uk.json',
    (status, code, key) => {
      expect(reportErrorKey(new ApiError(status, code, 'message'))).toEqual({
        key,
      });
      expect(i18n.exists(key)).toBe(true);
    },
  );

  it('[TC-05-03] falls back to the generic key for other errors', () => {
    expect(reportErrorKey(new ApiError(500, 'UNKNOWN_ERROR', 'boom'))).toEqual({
      key: 'errors.generic',
    });
    expect(reportErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
    expect(i18n.exists('errors.generic')).toBe(true);
  });
});
