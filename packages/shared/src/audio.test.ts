import { describe, expect, it } from 'vitest';
import {
  AUDIO_MIME_TYPES,
  ERROR_CODES,
  HINT_WORD_MAX,
  HintRequestSchema,
  HintResultSchema,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_SECONDS,
} from './index.js';

describe('audio and hint contracts', () => {
  it('[TC-04-13] audio limits and the MIME whitelist', () => {
    expect(MAX_AUDIO_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_RECORDING_SECONDS).toBe(120);
    expect(AUDIO_MIME_TYPES).toEqual(['audio/webm', 'audio/ogg', 'audio/mp4']);
  });

  it('[TC-04-13] audio error codes are exposed', () => {
    expect(ERROR_CODES.SPEECH_RECOGNITION_UNAVAILABLE).toBe(
      'SPEECH_RECOGNITION_UNAVAILABLE',
    );
    expect(ERROR_CODES.AUDIO_TOO_LARGE).toBe('AUDIO_TOO_LARGE');
    expect(ERROR_CODES.AUDIO_UNSUPPORTED).toBe('AUDIO_UNSUPPORTED');
  });

  it('[TC-04-05] HintRequestSchema accepts phrase_start and a trimmed translation word', () => {
    expect(HintRequestSchema.parse({ kind: 'phrase_start' })).toEqual({
      kind: 'phrase_start',
    });
    expect(
      HintRequestSchema.parse({ kind: 'translation', word: '  слово ' }),
    ).toEqual({ kind: 'translation', word: 'слово' });
    expect(
      HintRequestSchema.safeParse({
        kind: 'translation',
        word: 'a'.repeat(HINT_WORD_MAX),
      }).success,
    ).toBe(true);
  });

  it('[TC-04-05] HintRequestSchema rejects an empty or too long word, a missing word and an unknown kind', () => {
    expect(HINT_WORD_MAX).toBe(60);
    for (const input of [
      { kind: 'translation', word: '   ' },
      { kind: 'translation', word: 'a'.repeat(HINT_WORD_MAX + 1) },
      { kind: 'translation' },
      { kind: 'other' },
      {},
    ]) {
      expect(HintRequestSchema.safeParse(input).success).toBe(false);
    }
  });

  it('[TC-04-05] HintResultSchema accepts a phrase, a translation and an unknown word', () => {
    expect(
      HintResultSchema.parse({ kind: 'phrase_start', text: 'I think…' }),
    ).toEqual({ kind: 'phrase_start', text: 'I think…' });
    expect(
      HintResultSchema.parse({ kind: 'translation', word: 'house' }),
    ).toEqual({ kind: 'translation', word: 'house' });
    expect(HintResultSchema.parse({ kind: 'translation', word: null })).toEqual(
      { kind: 'translation', word: null },
    );
  });

  it('[TC-04-05] HintResultSchema rejects an empty text or word', () => {
    expect(
      HintResultSchema.safeParse({ kind: 'phrase_start', text: '' }).success,
    ).toBe(false);
    expect(
      HintResultSchema.safeParse({ kind: 'translation', word: '' }).success,
    ).toBe(false);
  });
});
