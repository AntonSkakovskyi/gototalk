import type { Utterance } from '@gototalk/shared';

export function sortBySeq(utterances: Utterance[]): Utterance[] {
  return utterances.toSorted((first, second) => first.seq - second.seq);
}

/** True when the last turn is an answer that the assistant has not replied to yet. */
export function awaitingReply(utterances: Utterance[]): boolean {
  return sortBySeq(utterances).at(-1)?.role === 'user';
}

export function currentQuestion(
  utterances: Utterance[],
): Utterance | undefined {
  return sortBySeq(utterances)
    .filter((utterance) => utterance.role === 'assistant')
    .at(-1);
}
