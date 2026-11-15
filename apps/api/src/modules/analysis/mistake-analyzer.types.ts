import type { BetterPhrasing } from '@gototalk/shared';
import type { Mistake } from '../../integrations/language-model/model-output.js';

export type AnalysisOutcome =
  | {
      status: 'done';
      mistakes: Mistake[];
      better: BetterPhrasing[];
      promptVersion: string;
      model: string;
    }
  | { status: 'failed'; promptVersion: string; model: string };
