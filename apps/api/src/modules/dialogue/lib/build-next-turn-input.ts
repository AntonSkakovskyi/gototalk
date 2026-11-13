import type { NextTurnInput } from '../../../integrations/language-model/language-model.port.js';
import { remainingQuestions } from '../../session/lib/plan-questions.js';

// Bounds the prompt size; plan progress is tracked separately from the history window
export const NEXT_TURN_HISTORY_LIMIT = 12;

interface DialogueUtterance {
  seq: number;
  role: 'assistant' | 'user';
  text: string;
}

export interface BuildNextTurnInput {
  topic: string;
  planQuestions: string[];
  /** Ordered by seq. */
  utterances: DialogueUtterance[];
}

export function buildNextTurnInput({
  topic,
  planQuestions,
  utterances,
}: BuildNextTurnInput): NextTurnInput {
  const askedTexts = utterances
    .filter(({ role }) => role === 'assistant')
    .map(({ text }) => text);
  return {
    topic,
    remainingQuestions: remainingQuestions(planQuestions, askedTexts),
    history: utterances
      .slice(-NEXT_TURN_HISTORY_LIMIT)
      .map(({ role, text }) => ({ role, text })),
  };
}
