import type { SessionDetails } from '@gototalk/shared';

export function currentQuestion(
  utterances: SessionDetails['utterances'],
): string | undefined {
  return utterances
    .filter((utterance) => utterance.role === 'assistant')
    .toSorted((first, second) => first.seq - second.seq)
    .at(-1)?.text;
}
