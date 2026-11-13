import { QUESTION_MAX } from '@gototalk/shared';
import type { Turn } from '@gototalk/shared';
import type { NextTurnInput } from './language-model.port.js';

const MIN_WORD_LENGTH = 4;
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

const followUp = (subject: string): string =>
  `Can you tell me more about ${subject}?`;

function lastLongWord(history: NextTurnInput['history']): string | undefined {
  const lastUser = history.findLast((entry) => entry.role === 'user');
  const words = lastUser?.text.match(WORD) ?? [];
  return words.findLast((word) => word.length >= MIN_WORD_LENGTH);
}

export function buildFakeTurn({
  remainingQuestions,
  history,
}: NextTurnInput): Turn {
  const [next] = remainingQuestions;
  if (next !== undefined) return { question: next };
  const word = lastLongWord(history);
  if (word === undefined) return { question: followUp('that') };
  const room = QUESTION_MAX - followUp('""').length;
  return { question: followUp(`"${word.slice(0, room)}"`) };
}
