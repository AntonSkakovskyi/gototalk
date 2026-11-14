import { ANSWER_TEXT_MAX } from '@gototalk/shared';
import { answerErrorMessage } from './answer-form';

describe('answerErrorMessage', () => {
  it('[TC-04-04] returns nothing without an error', () => {
    expect(answerErrorMessage(undefined)).toBeUndefined();
  });

  it('[TC-04-04] maps a too_big issue to the message with the limit', () => {
    expect(answerErrorMessage({ type: 'too_big' })).toEqual({
      key: 'dialogue.form.errors.tooLong',
      values: { max: ANSWER_TEXT_MAX },
    });
  });

  it.each(['too_small', undefined])(
    '[TC-04-04] maps the %s issue to the required message',
    (type) => {
      expect(answerErrorMessage({ type })).toEqual({
        key: 'dialogue.form.errors.required',
      });
    },
  );
});
