import { HINT_WORD_MAX } from '@gototalk/shared';
import i18n from '@/shared/i18n/index';
import { hintWordErrorMessage } from './hint-form';

describe('hintWordErrorMessage', () => {
  it('[TC-04-10] has no message without an issue', () => {
    expect(hintWordErrorMessage(undefined)).toBeUndefined();
  });

  it('[TC-04-10] asks for a word when the field is empty', () => {
    expect(hintWordErrorMessage({ type: 'too_small' })).toEqual({
      key: 'dialogue.hint.word.errors.required',
    });
  });

  it('[TC-04-10] reports the limit when the word is too long', () => {
    expect(hintWordErrorMessage({ type: 'too_big' })).toEqual({
      key: 'dialogue.hint.word.errors.tooLong',
      values: { max: HINT_WORD_MAX },
    });
  });

  it('[TC-04-10] both messages exist in uk.json', () => {
    expect(i18n.exists('dialogue.hint.word.errors.required')).toBe(true);
    expect(i18n.exists('dialogue.hint.word.errors.tooLong')).toBe(true);
  });
});
