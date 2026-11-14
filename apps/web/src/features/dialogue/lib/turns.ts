import type { Utterance } from '@gototalk/shared';

export function sortBySeq(utterances: Utterance[]): Utterance[] {
  return utterances.toSorted((first, second) => first.seq - second.seq);
}

export function currentQuestion(
  utterances: Utterance[],
): Utterance | undefined {
  return sortBySeq(utterances)
    .filter((utterance) => utterance.role === 'assistant')
    .at(-1);
}

export interface AnswerWithQuestion {
  question: Utterance | undefined;
  answer: Utterance;
}

export function answersWithQuestions(
  utterances: Utterance[],
): AnswerWithQuestion[] {
  const pairs: AnswerWithQuestion[] = [];
  let question: Utterance | undefined;
  for (const utterance of sortBySeq(utterances)) {
    if (utterance.role === 'assistant') {
      question = utterance;
    } else {
      pairs.push({ question, answer: utterance });
    }
  }
  return pairs;
}
