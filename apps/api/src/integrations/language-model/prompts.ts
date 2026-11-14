import type { SummarizeSessionInput } from './language-model.port.js';
import { renderPrompt } from './render-prompt.js';

export const ERROR_ANALYSIS_PROMPT_ID = 'error-analysis.v1';
export const NEXT_TURN_PROMPT_ID = 'next-turn.v1';
export const HINT_PROMPT_ID = 'hint.v1';
export const SESSION_SUMMARY_PROMPT_ID = 'session-summary.v1';

export interface ErrorAnalysisPromptInput {
  text: string;
}

export interface NextTurnPromptInput {
  topic: string;
  remainingQuestions: string[];
  history: { role: 'assistant' | 'user'; text: string }[];
}

export interface HintPromptInput {
  kind: 'phrase_start' | 'translation';
  question?: string;
  questionNumber?: number;
  word?: string;
}

export function renderErrorAnalysisPrompt(input: ErrorAnalysisPromptInput): {
  id: typeof ERROR_ANALYSIS_PROMPT_ID;
  text: string;
} {
  return renderPrompt(ERROR_ANALYSIS_PROMPT_ID, input);
}

export function renderNextTurnPrompt(input: NextTurnPromptInput): {
  id: typeof NEXT_TURN_PROMPT_ID;
  text: string;
} {
  return renderPrompt(NEXT_TURN_PROMPT_ID, input);
}

export function renderHintPrompt(input: HintPromptInput): {
  id: typeof HINT_PROMPT_ID;
  text: string;
} {
  return renderPrompt(HINT_PROMPT_ID, input);
}

export function renderSessionSummaryPrompt(input: SummarizeSessionInput): {
  id: typeof SESSION_SUMMARY_PROMPT_ID;
  text: string;
} {
  return renderPrompt(SESSION_SUMMARY_PROMPT_ID, input);
}
