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
  utterances: DialogueUtterance[];
}

export function buildNextTurnInput({
  topic,
  planQuestions,
  utterances,
}: BuildNextTurnInput): NextTurnInput {
  const ordered = [...utterances].sort((a, b) => a.seq - b.seq);
  const askedTexts = ordered
    .filter(({ role }) => role === 'assistant')
    .map(({ text }) => text);
  return {
    topic,
    remainingQuestions: remainingQuestions(planQuestions, askedTexts),
    history: ordered
      .slice(-NEXT_TURN_HISTORY_LIMIT)
      .map(({ role, text }) => ({ role, text })),
  };
}
