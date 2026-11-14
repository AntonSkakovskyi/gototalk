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
  [ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE]:
    'dialogue.errors.speechUnavailable',
  [ERROR_CODES.AUDIO_TOO_LARGE]: 'dialogue.errors.audioTooLarge',
  [ERROR_CODES.AUDIO_UNSUPPORTED]: 'dialogue.errors.audioUnsupported',
};

const HTTP_SERVER_ERROR = 500;

export function dialogueErrorKey(error: unknown): { key: string } {
  const key = error instanceof ApiError ? KEY_BY_CODE[error.code] : undefined;
  return { key: key ?? 'errors.generic' };
}

/** Network failures and 5xx may pass on a repeat; a 4xx would fail again with the same input. */
export function canRetryAnswer(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }
  return !(error instanceof ApiError) || error.status >= HTTP_SERVER_ERROR;
}
