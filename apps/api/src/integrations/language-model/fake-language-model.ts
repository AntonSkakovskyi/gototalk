import type { FakeLlmFailMode } from '../../core/config/env.schema.js';
import { LanguageModelUnavailableError } from './language-model.errors.js';
import type {
  AnalyzeUtteranceInput,
  AnalyzeUtteranceResponse,
  HintInput,
  LanguageModelPort,
  NextTurnInput,
  PlanSessionInput,
} from './language-model.port.js';
import { analyzeText } from './fake-analysis.js';
import {
  ERROR_ANALYSIS_PROMPT_ID,
  renderErrorAnalysisPrompt,
  renderHintPrompt,
  renderNextTurnPrompt,
} from './prompts.js';
import { buildFakeHint } from './fake-hints.js';
import { buildFakeTurn } from './fake-next-turn.js';
import { buildFakePlan } from './fake-session-plans.js';
import { renderSessionPlanPrompt } from './session-plan-prompt.js';

export interface FakeLanguageModelOptions {
  failMode?: FakeLlmFailMode;
}

export class FakeLanguageModel implements LanguageModelPort {
  private readonly failMode: FakeLlmFailMode | undefined;

  constructor(options: FakeLanguageModelOptions = {}) {
    this.failMode = options.failMode;
  }

  analyzeUtterance({
    text,
  }: AnalyzeUtteranceInput): Promise<AnalyzeUtteranceResponse> {
    if (this.failMode === 'unavailable') return unavailable();
    const response = (output: unknown): AnalyzeUtteranceResponse => ({
      output,
      promptVersion: ERROR_ANALYSIS_PROMPT_ID,
      model: 'fake',
    });
    if (this.failMode === 'invalid_json') {
      return Promise.resolve(response({ mistakes: 'broken' }));
    }
    return Promise.resolve().then(() => {
      renderErrorAnalysisPrompt({ text });
      return response(analyzeText(text));
    });
  }

  planSession(input: PlanSessionInput): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve().then(() => {
      renderSessionPlanPrompt(input);
      return buildFakePlan(input);
    });
  }

  nextTurn(input: NextTurnInput): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve().then(() => {
      renderNextTurnPrompt(input);
      return buildFakeTurn(input);
    });
  }

  hint(input: HintInput): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve().then(() => {
      renderHintPrompt(input);
      return buildFakeHint(input);
    });
  }

  summarizeSession(): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve({
      summary: 'Ви відповіли 1 раз за 1 хв. Помилок не знайдено, так тримати.',
      top_categories: [],
    });
  }
}

function unavailable(): Promise<never> {
  return Promise.reject(new LanguageModelUnavailableError());
}
