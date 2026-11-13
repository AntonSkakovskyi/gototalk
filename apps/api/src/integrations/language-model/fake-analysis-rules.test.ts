import { MISTAKE_CATEGORY_CODES, MistakeSchema } from '@gototalk/shared';
import { describe, expect, it } from 'vitest';
import { analyzeText } from './fake-analysis.js';
import { RULE_CASES } from './fake-analysis-rule-cases.js';
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
});
