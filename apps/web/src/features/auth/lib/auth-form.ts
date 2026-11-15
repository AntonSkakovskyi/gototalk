import { ERROR_CODES } from '@gototalk/shared';
import type { FieldError } from 'react-hook-form';
import { ApiError } from '@/shared/api/api-error';
import type { TranslationKey } from '@/shared/i18n/translation-key';

export function apiErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) {
    if (error.code === ERROR_CODES.INVALID_CREDENTIALS) {
      return 'auth.errors.invalidCredentials';
    }
    if (error.code === ERROR_CODES.EMAIL_TAKEN) {
      return 'auth.errors.emailTaken';
    }
  }
  return 'errors.generic';
}

// Maps field errors to i18n keys so the English Zod messages never reach the UI.
export function emailErrorKey(
  error: FieldError | undefined,
): TranslationKey | null {
  return error ? 'auth.validation.emailInvalid' : null;
}

export function passwordErrorKey(
  error: FieldError | undefined,
  tooShortKey: TranslationKey,
): TranslationKey | null {
  if (!error) {
    return null;
  }
  if (error.type === 'too_big') {
    return 'auth.validation.passwordTooLong';
  }
  return error.type === 'too_small'
    ? tooShortKey
    : 'auth.validation.passwordRequired';
}

export function deleteAccountErrorKey(error: unknown): TranslationKey {
  return error instanceof ApiError &&
    error.code === ERROR_CODES.INVALID_PASSWORD
    ? 'pages.profile.account.delete.invalidPassword'
    : 'errors.generic';
}
