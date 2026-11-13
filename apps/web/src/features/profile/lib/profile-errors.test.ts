import { ERROR_CODES, MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import { profileErrorKey } from './profile-errors';

const errors = [
  new ApiError(409, ERROR_CODES.ACTIVE_GOALS_LIMIT, 'limit'),
  new ApiError(404, ERROR_CODES.GOAL_NOT_FOUND, 'missing'),
  new ApiError(500, 'UNKNOWN_ERROR', 'boom'),
  new TypeError('Failed to fetch'),
];

describe('profileErrorKey', () => {
  it('[TC-02-02] maps the active goals limit with the shared maximum', () => {
    const error = new ApiError(409, ERROR_CODES.ACTIVE_GOALS_LIMIT, 'limit');

    expect(profileErrorKey(error)).toEqual({
      key: 'profile.goals.errors.limit',
      values: { max: MAX_ACTIVE_GOALS },
    });
  });

  it('[TC-02-02] maps a missing goal', () => {
    const error = new ApiError(404, ERROR_CODES.GOAL_NOT_FOUND, 'missing');

    expect(profileErrorKey(error)).toEqual({
      key: 'profile.goals.errors.notFound',
    });
  });

  it('[TC-02-02] falls back to the generic key for other errors', () => {
    expect(profileErrorKey(new ApiError(500, 'UNKNOWN_ERROR', 'boom'))).toEqual(
      { key: 'errors.generic' },
    );
    expect(profileErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
  });

  it.each(errors)(
    '[TC-02-02] returns a key present in uk.json for %s',
    (error) => {
      const { key, values } = profileErrorKey(error);

      expect(i18n.exists(key)).toBe(true);
      expect(i18n.t(key, values ?? {})).not.toContain('{{');
    },
  );
});
