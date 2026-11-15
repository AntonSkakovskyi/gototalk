import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import type { TranslationKey } from '@/shared/i18n/translation-key';

const KEY_BY_CODE: Record<string, TranslationKey> = {
  [ERROR_CODES.WORD_NOT_FOUND]: 'vocabulary.errors.notFound',
  [ERROR_CODES.WORD_ALREADY_ACTIVE]: 'vocabulary.errors.alreadyActive',
};

export function wordErrorKey(error: unknown): { key: TranslationKey } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
