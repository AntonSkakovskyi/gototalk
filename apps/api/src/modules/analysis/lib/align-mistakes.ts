import type { Mistake } from '../../../integrations/language-model/model-output.js';

export function alignMistakes(
  text: string,
  mistakes: Mistake[],
): { mistakes: Mistake[]; dropped: number } {
  const aligned: Mistake[] = [];
  for (const mistake of mistakes) {
    const placed = place(text, mistake);
    if (placed !== null) aligned.push(placed);
  }
  aligned.sort((a, b) => a.start - b.start);

  const accepted: Mistake[] = [];
  let previousEnd = 0;
  for (const mistake of aligned) {
    if (mistake.start < previousEnd) continue;
    accepted.push(mistake);
    previousEnd = mistake.end;
  }
  return { mistakes: accepted, dropped: mistakes.length - accepted.length };
}

function place(text: string, mistake: Mistake): Mistake | null {
  const { start, end, original } = mistake;
  if (end <= text.length && text.slice(start, end) === original) return mistake;
  const index = nearestOccurrence(text, original, start);
  if (index === null) return null;
  return { ...mistake, start: index, end: index + original.length };
}

function nearestOccurrence(
  text: string,
  needle: string,
  hint: number,
): number | null {
  let best: number | null = null;
  let index = text.indexOf(needle);
  while (index !== -1) {
    if (best === null || Math.abs(index - hint) < Math.abs(best - hint)) {
      best = index;
    }
    index = text.indexOf(needle, index + 1);
  }
  return best;
}
