import { MISTAKE_CATEGORY_CODES } from '@gototalk/shared';
import { MistakeSchema } from '../model-output.js';
import { describe, expect, it } from 'vitest';
import { analyzeText } from './fake-analysis.js';
import { RULE_CASES } from './testing/fake-analysis-rule-cases.js';
import { FAKE_ANALYSIS_RULES } from './fake-analysis-rules.js';

describe('fake analysis rules', () => {
  it('[TC-04-01] has 15 rules and the case table covers each of them', () => {
    expect(FAKE_ANALYSIS_RULES).toHaveLength(15);
    expect(new Set(RULE_CASES.map((c) => c.rule)).size).toBe(15);
  });

  it.each(RULE_CASES)(
    '[TC-04-01] rule $rule finds "$original" in "$text"',
    ({ text, original, suggestion, category }) => {
      const { mistakes } = analyzeText(text);

      const matching = mistakes.filter((m) => m.original === original);
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({ suggestion, category });
    },
  );

  it('[TC-04-01] every rule category exists in the mistake categories', () => {
    for (const rule of FAKE_ANALYSIS_RULES) {
      expect(MISTAKE_CATEGORY_CODES).toContain(rule.category);
    }
  });

  it('[TC-04-01] every rule is case-insensitive and global, with both explanations', () => {
    for (const rule of FAKE_ANALYSIS_RULES) {
      expect(rule.pattern.flags).toContain('i');
      expect(rule.pattern.flags).toContain('g');
      expect(rule.explanation_en).not.toBe('');
      expect(rule.translation_uk).toMatch(/[а-яіїєґ]/i);
    }
  });

  it('[TC-04-01] slice(start, end) === original and MistakeSchema holds after fillers, emoji and Cyrillic', () => {
    for (const c of RULE_CASES) {
      const text = `Um, ок 😀 uh, ${c.text}`;
      const { mistakes } = analyzeText(text);

      expect(mistakes.map((m) => m.original)).toContain(c.original);
      for (const m of mistakes) {
        expect(text.slice(m.start, m.end)).toBe(m.original);
        expect(MistakeSchema.safeParse(m).success).toBe(true);
      }
    }
  });

  it.each([
    'I have 3 years in this company.',
    'I have 5 years of experience.',
    'I have 2 years at the university.',
    'I have 4 years with them.',
    'I have 3 years ago.',
  ])('[TC-04-01] rule 4 does not flag a duration: "%s"', (text) => {
    expect(analyzeText(text).mistakes).toEqual([]);
  });

  it.each([
    'Did he go there?',
    'Let it go.',
    "Let's he go now.",
    'Can she work today?',
    'To make it work, we try.',
    'They help it work.',
    'Should he have time?',
  ])(
    '[TC-04-01] rule 2 does not flag an auxiliary or modal context: "%s"',
    (text) => {
      expect(analyzeText(text).mistakes).toEqual([]);
    },
  );
});
