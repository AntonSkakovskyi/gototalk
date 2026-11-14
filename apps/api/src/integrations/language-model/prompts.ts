import { renderPrompt } from './render-prompt.js';

export const ERROR_ANALYSIS_PROMPT_ID = 'error-analysis.v1';
export const NEXT_TURN_PROMPT_ID = 'next-turn.v1';
export const HINT_PROMPT_ID = 'hint.v1';

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
  return {
    id: ERROR_ANALYSIS_PROMPT_ID,
    text: renderPrompt(ERROR_ANALYSIS_PROMPT_ID, input).text,
  };
}

export function renderNextTurnPrompt(input: NextTurnPromptInput): {
  id: typeof NEXT_TURN_PROMPT_ID;
  text: string;
} {
  return {
    id: NEXT_TURN_PROMPT_ID,
    text: renderPrompt(NEXT_TURN_PROMPT_ID, input).text,
  };
}

export function renderHintPrompt(input: HintPromptInput): {
  id: typeof HINT_PROMPT_ID;
  text: string;
} {
  return {
    id: HINT_PROMPT_ID,
    text: renderPrompt(HINT_PROMPT_ID, input).text,
  };
}
