import { HINT_WORD_MAX } from '@gototalk/shared';

interface FieldIssue {
  type?: string;
}

interface HintWordErrorMessage {
  key: string;
  values?: { max: number };
}

const ERRORS = 'dialogue.hint.word.errors';

export function hintWordErrorMessage(
  error: FieldIssue | undefined,
): HintWordErrorMessage | undefined {
  if (!error) {
    return undefined;
  }
  return error.type === 'too_big'
    ? { key: `${ERRORS}.tooLong`, values: { max: HINT_WORD_MAX } }
    : { key: `${ERRORS}.required` };
}
