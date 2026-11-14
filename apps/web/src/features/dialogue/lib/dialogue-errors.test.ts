import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import { dialogueErrorKey } from './dialogue-errors';

const MAPPED_CODES = [
  [ERROR_CODES.SESSION_FINISHED, 'dialogue.errors.sessionFinished'],
  [ERROR_CODES.ANSWER_NOT_EXPECTED, 'dialogue.errors.answerNotExpected'],
  [ERROR_CODES.UTTERANCE_NOT_FOUND, 'dialogue.errors.utteranceNotFound'],
  [ERROR_CODES.MISTAKE_NOT_FOUND, 'dialogue.errors.mistakeNotFound'],
  [ERROR_CODES.SESSION_NOT_FOUND, 'session.errors.notFound'],
  [ERROR_CODES.CONSENT_REQUIRED, 'dialogue.errors.consentRequired'],
  [ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE, 'dialogue.errors.modelUnavailable'],
  [
    ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
    'dialogue.errors.modelInvalidResponse',
  ],
] as const;

describe('dialogueErrorKey', () => {
  it.each(MAPPED_CODES)('[TC-04-04] maps %s to %s', (code, key) => {
    expect(dialogueErrorKey(new ApiError(409, code, 'message'))).toEqual({
      key,
    });
  });

  it.each(MAPPED_CODES)(
    '[TC-04-04] %s resolves to a text present in uk.json',
    (code) => {
      const { key } = dialogueErrorKey(new ApiError(409, code, 'message'));

      expect(i18n.exists(key)).toBe(true);
    },
  );

  it('[TC-04-04] falls back to the generic key for other errors', () => {
    expect(
      dialogueErrorKey(new ApiError(500, 'UNKNOWN_ERROR', 'boom')),
    ).toEqual({ key: 'errors.generic' });
    expect(dialogueErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
    expect(i18n.exists('errors.generic')).toBe(true);
  });
});
