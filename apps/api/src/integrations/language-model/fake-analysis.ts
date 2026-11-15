import { ANALYSIS_MAX_MISTAKES } from './model-output.js';
import type { BetterPhrasing } from '@gototalk/shared';
import type { Mistake } from './model-output.js';
import { FAKE_ANALYSIS_RULES } from './fake-analysis-rules.js';

export interface FakeAnalysis {
  mistakes: Mistake[];
  better: BetterPhrasing[];
}

const MAX_BETTER = 2;
const MAX_SENTENCE_LENGTH = 200;
const SENTENCE = /[^.?!]+[.?!]*/g;

/** Positions are UTF-16 offsets in `text`, so text.slice(start, end) === original. */
export function analyzeText(text: string): FakeAnalysis {
  const mistakes = findMistakes(text);
  return { mistakes, better: buildBetter(text, mistakes) };
}

function findMistakes(text: string): Mistake[] {
  const candidates: Mistake[] = [];
  for (const rule of FAKE_ANALYSIS_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
        suggestion: rule.suggest([
          match[1] ?? '',
          match[2] ?? '',
          match[3] ?? '',
        ]),
        category: rule.category,
        explanation_en: rule.explanation_en,
        translation_uk: rule.translation_uk,
      });
    }
  }
  // Array.prototype.sort is stable, so rule order breaks ties
  candidates.sort((a, b) => a.start - b.start);

  const accepted: Mistake[] = [];
  let lastEnd = 0;
  for (const mistake of candidates) {
    if (accepted.length === ANALYSIS_MAX_MISTAKES) break;
    if (mistake.start < lastEnd) continue;
    accepted.push(mistake);
    lastEnd = mistake.end;
  }
  return accepted;
}

function buildBetter(text: string, mistakes: Mistake[]): BetterPhrasing[] {
  const better: BetterPhrasing[] = [];
  for (const sentence of text.matchAll(SENTENCE)) {
    if (better.length === MAX_BETTER) break;
    const leading = sentence[0].length - sentence[0].trimStart().length;
    const original = sentence[0].trim();
    if (original === '' || original.length > MAX_SENTENCE_LENGTH) continue;

    const start = sentence.index + leading;
    const end = start + original.length;
    const inside = mistakes.filter((m) => m.start >= start && m.end <= end);
    if (inside.length === 0) continue;

    let corrected = original;
    for (const m of [...inside].reverse()) {
      corrected =
        corrected.slice(0, m.start - start) +
        m.suggestion +
        corrected.slice(m.end - start);
    }
    if (corrected.length <= MAX_SENTENCE_LENGTH) {
      better.push({ original, better: corrected });
    }
  }
  return better;
}
