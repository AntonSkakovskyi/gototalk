import type { Mistake } from '@gototalk/shared';
import type { FakeLlmFailMode } from '../../core/config/env.schema.js';
import { LanguageModelUnavailableError } from './language-model.errors.js';
import type {
  AnalyzeUtteranceInput,
  AnalyzeUtteranceResponse,
  HintRequest,
  LanguageModelPort,
  PlanSessionInput,
} from './language-model.port.js';
import { ERROR_ANALYSIS_PROMPT_ID } from './prompts.js';
import { buildFakePlan } from './fake-session-plans.js';
import { renderSessionPlanPrompt } from './session-plan-prompt.js';

type MistakeTemplate = Omit<Mistake, 'start' | 'end'>;

// Positions are found at runtime so slice(start, end) === original holds for any input
const TEMPLATES: MistakeTemplate[] = [
  {
    original: 'yesterday I go',
    suggestion: 'yesterday I went',
    category: 'verb_tense',
    explanation_en:
      'Use the past simple for finished actions with a past time marker.',
    translation_uk:
      'Для завершених дій з маркером минулого вживається Past Simple.',
  },
  {
    original: 'I very like',
    suggestion: 'I really like',
    category: 'word_order',
    explanation_en:
      '"Very" does not go before a verb; use "really" or "very much".',
    translation_uk:
      '«Very» не ставиться перед дієсловом; вживайте «really» або «very much».',
  },
];

const BETTER = [
  {
    original: 'yesterday I go to the office',
    better: 'yesterday I went to the office',
  },
  { original: 'I very like my job', better: 'I really like my job' },
];

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
    const mistakes: Mistake[] = [];
    for (const { original, ...rest } of TEMPLATES) {
      const start = text.indexOf(original);
      if (start >= 0) {
        mistakes.push({
          start,
          end: start + original.length,
          original,
          ...rest,
        });
      }
    }
    const better = BETTER.filter((b) => text.includes(b.original));
    return Promise.resolve(response({ mistakes, better }));
  }

  planSession(input: PlanSessionInput): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve().then(() => {
      renderSessionPlanPrompt(input);
      return buildFakePlan(input);
    });
  }

  nextTurn(): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    return Promise.resolve({
      question: 'Tell me about your experience working on it.',
    });
  }

  hint(request: HintRequest): Promise<unknown> {
    if (this.failMode === 'unavailable') return unavailable();
    switch (request.kind) {
      case 'phrase_start':
        return Promise.resolve({ kind: 'phrase_start', text: 'I think that…' });
      case 'translation':
        return Promise.resolve({ kind: 'translation', word: 'meeting' });
    }
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
