import { ERROR_CODES } from '@gototalk/shared';
import type { FieldError } from 'react-hook-form';
import { ApiError } from '../api/api-error.js';

export function apiErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ERROR_CODES.INVALID_CREDENTIALS) {
      return 'auth.errors.invalidCredentials';
    }
    if (error.code === ERROR_CODES.EMAIL_TAKEN) {
      return 'auth.errors.emailTaken';
    }
  }
  return 'auth.errors.generic';
}

// Maps field errors to i18n keys so the English Zod messages never reach the UI.
export function emailErrorKey(error: FieldError | undefined): string | null {
  return error ? 'auth.validation.emailInvalid' : null;
}

export function passwordErrorKey(
  error: FieldError | undefined,
  tooShortKey: string,
): string | null {
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
