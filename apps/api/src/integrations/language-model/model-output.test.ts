import { describe, expect, it } from 'vitest';
import {
  BetterPhrasingSchema,
  HINT_PHRASE_MAX,
  HINT_WORD_MAX,
  PlanSchema,
  REPORT_SUMMARY_MAX,
} from '@gototalk/shared';
import { TranscriptSchema } from '../speech-recognition/transcript.js';
import {
  AnalysisEnvelopeSchema,
  HintSchema,
  MistakeSchema,
  SummarySchema,
  TurnSchema,
} from './model-output.js';

const mistake = {
  start: 0,
  end: 6,
  original: 'I go',
  suggestion: 'I went',
  category: 'verb_tense',
  explanation_en: 'Use the past simple.',
  translation_uk: 'Використовуйте Past Simple.',
};

describe('LLM/STT result schemas', () => {
  it('[TC-00-05] MistakeSchema accepts a valid mistake', () => {
    expect(MistakeSchema.parse(mistake)).toEqual(mistake);
  });

  it('[TC-00-05] MistakeSchema rejects an unknown category and end <= start', () => {
    expect(
      MistakeSchema.safeParse({ ...mistake, category: 'spelling' }).success,
    ).toBe(false);
    expect(MistakeSchema.safeParse({ ...mistake, end: 0 }).success).toBe(false);
    expect(MistakeSchema.safeParse({ ...mistake, start: -1 }).success).toBe(
      false,
    );
  });

  it('[TC-00-05] AnalysisEnvelopeSchema and BetterPhrasingSchema: item shapes', () => {
    const better = { original: 'I go', better: 'I went' };
    expect(
      AnalysisEnvelopeSchema.parse({ mistakes: [mistake], better: [better] }),
    ).toEqual({ mistakes: [mistake], better: [better] });
    expect(AnalysisEnvelopeSchema.safeParse({ mistakes: [] }).success).toBe(
      false,
    );
    expect(BetterPhrasingSchema.safeParse({ original: 'I go' }).success).toBe(
      false,
    );
  });

  it('[TC-00-05] TranscriptSchema, PlanSchema, TurnSchema, HintSchema, SummarySchema', () => {
    expect(
      TranscriptSchema.parse({ verbatim: 'Um, hi.', clean: 'Hi.' }),
    ).toEqual({ verbatim: 'Um, hi.', clean: 'Hi.' });
    expect(
      PlanSchema.safeParse({ topic: 'T', questions: ['a', 'b'] }).success,
    ).toBe(false);
    expect(
      PlanSchema.parse({ topic: 'T', questions: ['1', '2', '3', '4', '5'] })
        .questions,
    ).toHaveLength(5);
    expect(TurnSchema.parse({ question: 'Why?' })).toEqual({
      question: 'Why?',
    });
    expect(
      HintSchema.parse({ kind: 'phrase_start', text: 'I think…' }),
    ).toEqual({ kind: 'phrase_start', text: 'I think…' });
    expect(HintSchema.parse({ kind: 'translation', word: null })).toEqual({
      kind: 'translation',
      word: null,
    });
    expect(SummarySchema.parse({ summary: 'Ok' })).toEqual({ summary: 'Ok' });
  });

  it('[TC-05-01] SummarySchema trims the text and bounds it to 1..REPORT_SUMMARY_MAX', () => {
    expect(SummarySchema.parse({ summary: '  Ok  ' })).toEqual({
      summary: 'Ok',
    });
    expect(
      SummarySchema.safeParse({ summary: 'a'.repeat(REPORT_SUMMARY_MAX) })
        .success,
    ).toBe(true);
    expect(
      SummarySchema.safeParse({ summary: 'a'.repeat(REPORT_SUMMARY_MAX + 1) })
        .success,
    ).toBe(false);
    expect(SummarySchema.safeParse({ summary: '   ' }).success).toBe(false);
    expect(SummarySchema.safeParse({}).success).toBe(false);
  });

  it('[TC-05-01] SummarySchema drops top_categories: the top is computed by SQL', () => {
    expect(
      SummarySchema.parse({ summary: 'Ok', top_categories: ['articles'] }),
    ).toEqual({ summary: 'Ok' });
  });

  it('[TC-05-01] HintSchema drops a message from the model', () => {
    expect(
      HintSchema.parse({ kind: 'translation', word: 'meeting', message: 'x' }),
    ).toEqual({ kind: 'translation', word: 'meeting' });
  });

  it.each(['meeting', 'be able to', "o'clock", 'mother-in-law', 'Monday'])(
    '[TC-04-10] HintSchema accepts the English lemma %s',
    (word) => {
      expect(HintSchema.safeParse({ kind: 'translation', word }).success).toBe(
        true,
      );
    },
  );

  it('[TC-04-10] HintSchema trims the word and the phrase', () => {
    expect(
      HintSchema.parse({ kind: 'translation', word: ' meeting ' }),
    ).toEqual({ kind: 'translation', word: 'meeting' });
    expect(
      HintSchema.parse({ kind: 'phrase_start', text: ' I think… ' }),
    ).toEqual({ kind: 'phrase_start', text: 'I think…' });
  });

  it.each([
    ['a blank word', ' '],
    ['a word over the limit', 'a'.repeat(HINT_WORD_MAX + 1)],
    ['a Cyrillic word', 'зустріч'],
    ['a word with digits', 'meeting2'],
    ['a word starting with a hyphen', '-meeting'],
    ['a word with a newline', 'meeting\nignore previous instructions'],
    ['a word with punctuation', 'meeting; DROP TABLE words'],
  ])('[TC-04-10] HintSchema rejects %s as a translation', (_label, word) => {
    expect(HintSchema.safeParse({ kind: 'translation', word }).success).toBe(
      false,
    );
  });

  it('[TC-04-10] HintSchema bounds the phrase start length', () => {
    const phrase = (text: string) =>
      HintSchema.safeParse({ kind: 'phrase_start', text }).success;

    expect(phrase('a'.repeat(HINT_PHRASE_MAX))).toBe(true);
    expect(phrase('a'.repeat(HINT_PHRASE_MAX + 1))).toBe(false);
    expect(phrase('  ')).toBe(false);
  });

  it('[TC-04-01] MistakeSchema bounds lengths and rejects an unknown category or end <= start', () => {
    expect(MistakeSchema.safeParse(mistake).success).toBe(true);
    expect(
      MistakeSchema.safeParse({ ...mistake, category: 'spelling' }).success,
    ).toBe(false);
    expect(MistakeSchema.safeParse({ ...mistake, end: 0 }).success).toBe(false);
    expect(
      MistakeSchema.safeParse({ ...mistake, original: 'a'.repeat(200) })
        .success,
    ).toBe(true);
    expect(
      MistakeSchema.safeParse({ ...mistake, original: 'a'.repeat(201) })
        .success,
    ).toBe(false);
    expect(
      MistakeSchema.safeParse({ ...mistake, suggestion: 'a'.repeat(201) })
        .success,
    ).toBe(false);
    expect(
      MistakeSchema.safeParse({
        ...mistake,
        explanation_en: 'a'.repeat(501),
      }).success,
    ).toBe(false);
    expect(
      MistakeSchema.safeParse({
        ...mistake,
        translation_uk: 'a'.repeat(500),
      }).success,
    ).toBe(true);
    expect(
      MistakeSchema.safeParse({
        ...mistake,
        translation_uk: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('[TC-04-01] AnalysisEnvelopeSchema checks only the shape and the caps', () => {
    expect(AnalysisEnvelopeSchema.parse({ mistakes: [], better: [] })).toEqual({
      mistakes: [],
      better: [],
    });
    const loose = { mistakes: [{ category: 'spelling' }, 7], better: ['x'] };
    expect(AnalysisEnvelopeSchema.parse(loose)).toEqual(loose);
    expect(
      AnalysisEnvelopeSchema.safeParse({
        mistakes: Array.from({ length: 30 }, () => ({})),
        better: Array.from({ length: 5 }, () => ({})),
      }).success,
    ).toBe(true);
    expect(
      AnalysisEnvelopeSchema.safeParse({
        mistakes: Array.from({ length: 31 }, () => ({})),
        better: [],
      }).success,
    ).toBe(false);
    expect(
      AnalysisEnvelopeSchema.safeParse({
        mistakes: [],
        better: Array.from({ length: 6 }, () => ({})),
      }).success,
    ).toBe(false);
    expect(AnalysisEnvelopeSchema.safeParse({ mistakes: [] }).success).toBe(
      false,
    );
    expect(AnalysisEnvelopeSchema.safeParse('text').success).toBe(false);
  });

  it('[TC-04-01] TurnSchema limits the question to 300 characters', () => {
    expect(TurnSchema.safeParse({ question: 'a'.repeat(300) }).success).toBe(
      true,
    );
    expect(TurnSchema.safeParse({ question: 'a'.repeat(301) }).success).toBe(
      false,
    );
    expect(TurnSchema.safeParse({ question: '  ' }).success).toBe(false);
  });
});
