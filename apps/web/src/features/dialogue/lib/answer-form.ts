import { ANSWER_TEXT_MAX } from '@gototalk/shared';

interface FieldIssue {
  type?: string;
}

interface AnswerErrorMessage {
  key: string;
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
