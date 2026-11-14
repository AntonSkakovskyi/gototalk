import { ERROR_CODES } from '@gototalk/shared';
import { ApiError } from '@/shared/api/http';
import i18n from '@/shared/i18n/index';
import {
  isTransientError,
  dialogueErrorKey,
  hintErrorKey,
} from './dialogue-errors';

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
  [
    ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE,
    'dialogue.errors.speechUnavailable',
  ],
  [ERROR_CODES.AUDIO_TOO_LARGE, 'dialogue.errors.audioTooLarge'],
  [ERROR_CODES.AUDIO_UNSUPPORTED, 'dialogue.errors.audioUnsupported'],
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

describe('hintErrorKey', () => {
  const HINT_CODES = [
    [
      503,
      ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
      'dialogue.hint.errors.modelUnavailable',
    ],
    [
      502,
      ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      'dialogue.hint.errors.modelInvalidResponse',
    ],
    [409, ERROR_CODES.SESSION_FINISHED, 'dialogue.errors.sessionFinished'],
    [409, ERROR_CODES.ANSWER_NOT_EXPECTED, 'dialogue.errors.answerNotExpected'],
    [403, ERROR_CODES.CONSENT_REQUIRED, 'dialogue.errors.consentRequired'],
  ] as const;

  it.each(HINT_CODES)(
    '[TC-04-10] maps %i %s to %s, present in uk.json',
    (status, code, key) => {
      const mapped = hintErrorKey(new ApiError(status, code, 'message'));

      expect(mapped).toEqual({ key });
      expect(i18n.exists(key)).toBe(true);
    },
  );

  it('[TC-04-10] falls back to the generic key for a network failure and unknown errors', () => {
    expect(hintErrorKey(new TypeError('Failed to fetch'))).toEqual({
      key: 'errors.generic',
    });
    expect(hintErrorKey(new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toEqual({
      key: 'errors.generic',
    });
  });
});

describe('isTransientError', () => {
  it.each([
    [503, ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE],
    [500, 'INTERNAL_ERROR'],
  ])('[TC-04-08] allows a retry after %i %s', (status, code) => {
    expect(isTransientError(new ApiError(status, code, 'message'))).toBe(true);
  });

  it('[TC-04-08] allows a retry after a network failure', () => {
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it.each([
    [413, ERROR_CODES.AUDIO_TOO_LARGE],
    [415, ERROR_CODES.AUDIO_UNSUPPORTED],
    [409, ERROR_CODES.SESSION_FINISHED],
    [404, ERROR_CODES.SESSION_NOT_FOUND],
  ])(
    '[TC-04-08] does not retry the same upload after %i %s',
    (status, code) => {
      expect(isTransientError(new ApiError(status, code, 'message'))).toBe(
        false,
      );
    },
  );

  it('[TC-04-08] has nothing to retry without an error', () => {
    expect(isTransientError(null)).toBe(false);
  });
});
