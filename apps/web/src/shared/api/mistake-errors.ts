import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from './http';

const KEY_BY_CODE: Record<string, string> = {
  [ERROR_CODES.MISTAKE_NOT_FOUND]: 'dialogue.errors.mistakeNotFound',
  [ERROR_CODES.SESSION_NOT_FOUND]: 'session.errors.notFound',
};

export function markMistakeErrorKey(error: unknown): { key: string } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
