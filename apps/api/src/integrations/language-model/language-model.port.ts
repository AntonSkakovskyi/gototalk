import type { MistakeCategoryCode } from '@gototalk/shared';

export const LANGUAGE_MODEL_PORT = Symbol('LANGUAGE_MODEL_PORT');

export interface AnalyzeUtteranceInput {
  /** text_verbatim: mistake positions are offsets in it. */
  text: string;
}

export interface PlanSessionInput {
  level: string;
  scenes: string[];
  goals: string[];
  patterns: MistakeCategoryCode[];
  previousTopics: string[];
  customTopic?: string;
}

export interface NextTurnInput {
  topic: string;
  remainingQuestions: string[];
  history: { role: 'assistant' | 'user'; text: string }[];
}

export type HintInput =
  | { kind: 'phrase_start'; question: string; questionNumber: number }
  | { kind: 'translation'; word: string };

export interface SummarizeSessionInput {
  answers: number;
  minutes: number;
  categories: {
    code: MistakeCategoryCode;
    title: string;
    count: number;
    examples: { original: string; suggestion: string }[];
  }[];
}

export interface AnalyzeUtteranceResponse {
  /** Raw model response, validated by the caller; positions are offsets in text_verbatim. */
  output: unknown;
  promptVersion: string;
  model: string;
}

/** Every method returns the raw model output: callers validate it with a schema. */
export interface LanguageModelPort {
  analyzeUtterance(
    input: AnalyzeUtteranceInput,
  ): Promise<AnalyzeUtteranceResponse>;
  planSession(input: PlanSessionInput): Promise<unknown>;
  nextTurn(input: NextTurnInput): Promise<unknown>;
  hint(input: HintInput): Promise<unknown>;
  summarizeSession(input: SummarizeSessionInput): Promise<unknown>;
}
