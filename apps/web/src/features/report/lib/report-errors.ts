import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import type { TranslationKey } from '@/shared/i18n/translation-key';

const KEY_BY_CODE: Record<string, TranslationKey> = {
  [ERROR_CODES.SESSION_NOT_FOUND]: 'session.errors.notFound',
  [ERROR_CODES.SESSION_NOT_FINISHED]: 'report.errors.notFinished',
  [ERROR_CODES.CONSENT_REQUIRED]: 'dialogue.errors.consentRequired',
};

export function reportErrorKey(error: unknown): { key: TranslationKey } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
