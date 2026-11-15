import type { Utterance } from '@gototalk/shared';

export function questionsByAnswer(
  utterances: Utterance[],
): ReadonlyMap<string, Utterance> {
  const questions = new Map<string, Utterance>();
  let question: Utterance | undefined;
  const ordered = utterances.toSorted((a, b) => a.seq - b.seq);
  for (const utterance of ordered) {
    if (utterance.role === 'assistant') {
      question = utterance;
    } else if (question) {
      questions.set(utterance.id, question);
    }
  }
  return questions;
}
