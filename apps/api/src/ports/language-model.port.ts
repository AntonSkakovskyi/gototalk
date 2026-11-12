import type {
  AnalysisResult,
  Hint,
  MistakeCategoryCode,
  Plan,
  Summary,
  Turn,
} from '@gototalk/shared';

export const LANGUAGE_MODEL_PORT = Symbol('LANGUAGE_MODEL_PORT');

export interface AnalyzeUtteranceInput {
  /** text_verbatim: mistake positions are offsets in it. */
  text: string;
}

export interface PlanSessionInput {
  level: string;
  scenes: string[];
  patterns: MistakeCategoryCode[];
  previousTopics: string[];
  customTopic?: string;
}

export interface NextTurnInput {
  plan: Plan;
  history: { role: 'assistant' | 'user'; text: string }[];
}

export type HintRequest =
  | { kind: 'phrase_start'; question: string }
  | { kind: 'translation'; word: string };

export interface SummarizeSessionInput {
  answers: number;
  minutes: number;
  mistakes: { category: MistakeCategoryCode }[];
}

export interface LanguageModelPort {
  analyzeUtterance(input: AnalyzeUtteranceInput): Promise<AnalysisResult>;
  planSession(input: PlanSessionInput): Promise<Plan>;
  nextTurn(input: NextTurnInput): Promise<Turn>;
  hint(request: HintRequest): Promise<Hint>;
  summarizeSession(input: SummarizeSessionInput): Promise<Summary>;
}
