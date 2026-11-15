import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';

const KEY_BY_CODE: Record<string, string> = {
  [ERROR_CODES.WORD_NOT_FOUND]: 'vocabulary.errors.notFound',
  [ERROR_CODES.WORD_ALREADY_ACTIVE]: 'vocabulary.errors.alreadyActive',
};

export function wordErrorKey(error: unknown): { key: string } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
