import type { BetterPhrasing, Mistake } from '@gototalk/shared';

export type AnalysisOutcome =
  | {
      status: 'done';
      mistakes: Mistake[];
      better: BetterPhrasing[];
      promptVersion: string;
      model: string;
    }
  | { status: 'failed'; promptVersion: string; model: string };
