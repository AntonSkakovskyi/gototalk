import { ANSWER_TEXT_MAX } from '@gototalk/shared';
import type { TranslationKey } from '@/shared/i18n/translation-key';

interface FieldIssue {
  type?: string;
}

interface AnswerErrorMessage {
  key: TranslationKey;
  values?: { max: number };
}

const ERRORS = 'dialogue.form.errors';

export function answerErrorMessage(
  error: FieldIssue | undefined,
): AnswerErrorMessage | undefined {
  if (!error) {
    return undefined;
  }
  return error.type === 'too_big'
    ? { key: `${ERRORS}.tooLong`, values: { max: ANSWER_TEXT_MAX } }
    : { key: `${ERRORS}.required` };
}
