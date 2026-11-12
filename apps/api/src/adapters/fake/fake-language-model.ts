import type {
  AnalysisResult,
  Hint,
  Mistake,
  Plan,
  Summary,
  Turn,
} from '@gototalk/shared';
import type {
  AnalyzeUtteranceInput,
  HintRequest,
  LanguageModelPort,
} from '../../ports/language-model.port.js';

type MistakeTemplate = Omit<Mistake, 'start' | 'end'>;

// Мінімум: дві фіксовані помилки з транскрипту №0 (stubs.md, правила 5 і 9).
// Позиції не зашиті, а шукаються в тексті, щоб `slice(start, end) === original`
// виконувалось для будь-якого входу. Повні правила – у spec 04.
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

export class FakeLanguageModel implements LanguageModelPort {
  analyzeUtterance({ text }: AnalyzeUtteranceInput): Promise<AnalysisResult> {
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
    return Promise.resolve({ mistakes, better });
  }

  planSession(): Promise<Plan> {
    return Promise.resolve({
      topic: 'My last project at work',
      questions: [
        'What was the main goal of your last project at work?',
        'Tell me about your experience working on it.',
        'What do you think was the most important part of it?',
        'How is it different from your previous projects?',
        'What would you do differently next time?',
      ],
    });
  }

  nextTurn(): Promise<Turn> {
    return Promise.resolve({
      question: 'Tell me about your experience working on it.',
    });
  }

  hint(request: HintRequest): Promise<Hint> {
    switch (request.kind) {
      case 'phrase_start':
        return Promise.resolve({ kind: 'phrase_start', text: 'I think that…' });
      case 'translation':
        return Promise.resolve({ kind: 'translation', word: 'meeting' });
    }
  }

  summarizeSession(): Promise<Summary> {
    return Promise.resolve({
      summary: 'Ви відповіли 1 раз за 1 хв. Помилок не знайдено, так тримати.',
      top_categories: [],
    });
  }
}
