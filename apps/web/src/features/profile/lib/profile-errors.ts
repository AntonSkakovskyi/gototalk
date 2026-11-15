import { ERROR_CODES, MAX_ACTIVE_GOALS } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import type { TranslationKey } from '@/shared/i18n/translation-key';

export interface ProfileErrorMessage {
  key: TranslationKey;
  values?: { max: number };
}

export function profileErrorKey(error: unknown): ProfileErrorMessage {
  if (error instanceof ApiError) {
    if (error.code === ERROR_CODES.ACTIVE_GOALS_LIMIT) {
      return {
        key: 'profile.goals.errors.limit',
        values: { max: MAX_ACTIVE_GOALS },
      };
    }
    if (error.code === ERROR_CODES.GOAL_NOT_FOUND) {
      return { key: 'profile.goals.errors.notFound' };
    }
  }
  return { key: 'errors.generic' };
}
