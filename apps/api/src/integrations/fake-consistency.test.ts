import {
  AnalysisEnvelopeSchema,
  HintResultSchema,
  HintSchema,
  MistakeSchema,
  type MistakeCategoryCode,
} from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { FakeLanguageModel } from './language-model/fake-language-model.js';
import { FakeSpeechRecognition } from './speech-recognition/fake-speech-recognition.js';

const EXPECTED_CATEGORIES: MistakeCategoryCode[][] = [
  ['verb_tense', 'word_order'],
  ['l1_calque', 'articles', 'prepositions'],
  ['subject_verb_agreement', 'missing_be'],
  ['l1_calque', 'prepositions', 'conditionals'],
  ['prepositions', 'plural_countable', 'word_choice'],
];

const stt = new FakeSpeechRecognition();
const llm = new FakeLanguageModel();

describe('Fake STT and Fake LLM consistency', () => {
  it.each(EXPECTED_CATEGORIES.map((categories, i) => [i, categories] as const))(
    '[TC-04-01] transcript #%i: analysis finds the expected categories at valid positions',
    async (index, categories) => {
      const { verbatim } = await stt.transcribe(
        Buffer.alloc(0),
        'audio/webm',
        index,
      );

      const { output } = await llm.analyzeUtterance({ text: verbatim });

      const envelope = AnalysisEnvelopeSchema.parse(output);
      const mistakes = envelope.mistakes.map((item) =>
        MistakeSchema.parse(item),
      );
      expect(new Set(mistakes.map((m) => m.category))).toEqual(
        new Set(categories),
      );
      for (const m of mistakes) {
        expect(verbatim.slice(m.start, m.end)).toBe(m.original);
      }
    },
  );

  it('[TC-04-01] hints validate against HintSchema and the HTTP HintResultSchema', async () => {
    const results = await Promise.all([
      llm.hint({ kind: 'phrase_start', question: 'Why?', questionNumber: 1 }),
      llm.hint({ kind: 'translation', word: 'зустріч' }),
      llm.hint({ kind: 'translation', word: 'динозавр' }),
    ]);

    for (const result of results) {
      expect(HintSchema.parse(result)).toEqual(result);
      expect(HintResultSchema.parse(result)).toEqual(result);
    }
  });
});
