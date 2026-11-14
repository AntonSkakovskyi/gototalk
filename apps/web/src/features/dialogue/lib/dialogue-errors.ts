import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';

const KEY_BY_CODE: Record<string, string> = {
  [ERROR_CODES.SESSION_FINISHED]: 'dialogue.errors.sessionFinished',
  [ERROR_CODES.ANSWER_NOT_EXPECTED]: 'dialogue.errors.answerNotExpected',
  [ERROR_CODES.UTTERANCE_NOT_FOUND]: 'dialogue.errors.utteranceNotFound',
  [ERROR_CODES.MISTAKE_NOT_FOUND]: 'dialogue.errors.mistakeNotFound',
  [ERROR_CODES.SESSION_NOT_FOUND]: 'session.errors.notFound',
  [ERROR_CODES.CONSENT_REQUIRED]: 'dialogue.errors.consentRequired',
  [ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE]: 'dialogue.errors.modelUnavailable',
  [ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE]:
    'dialogue.errors.modelInvalidResponse',
};

export function dialogueErrorKey(error: unknown): { key: string } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}
