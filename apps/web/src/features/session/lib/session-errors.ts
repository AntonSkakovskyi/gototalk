import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';

const KEY_BY_CODE: Record<string, string> = {
  [ERROR_CODES.CONSENT_REQUIRED]: 'session.errors.consentRequired',
  [ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE]:
    'session.errors.planUnavailable',
  [ERROR_CODES.SESSION_NOT_FOUND]: 'session.errors.notFound',
};

export function sessionErrorKey(error: unknown): { key: string } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
