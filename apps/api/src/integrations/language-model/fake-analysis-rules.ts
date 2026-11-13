import type { MistakeCategoryCode } from '@gototalk/shared';
import {
  beForm,
  matchCase,
  pastTense,
  thirdPerson,
} from './fake-verb-forms.js';

/** Capture groups 1..3 of the rule pattern, empty when absent. */
export type CaptureGroups = readonly [string, string, string];

export interface FakeAnalysisRule {
  pattern: RegExp;
  category: MistakeCategoryCode;
  suggest: (groups: CaptureGroups) => string;
  explanation_en: string;
  translation_uk: string;
}

const PAST_MARKER = 'yesterday|last week|last month|last year|last night';
const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const NUMBERS =
  'a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';

/** Order is the tie-break for matches that start at the same offset. */
export const FAKE_ANALYSIS_RULES: FakeAnalysisRule[] = [
  {
    pattern: /\bI\s+am\s+agree\b/gi,
    category: 'l1_calque',
    suggest: () => 'I agree',
    explanation_en: '"Agree" is a verb, so it does not need "am".',
    translation_uk: '«Agree» – це дієслово, «am» не потрібне.',
  },
  {
    pattern:
      /\b(he|she|it)\s+(go|have|do|work|like|want|live|make|play|need)\b/gi,
    category: 'subject_verb_agreement',
    suggest: (g) => `${g[0]} ${thirdPerson(g[1])}`,
    explanation_en: 'With he/she/it the present simple verb takes -s.',
    translation_uk:
      'З he/she/it дієслово в теперішньому часі має закінчення -s.',
  },
  {
    pattern: new RegExp(
      `\\b(since)\\s+((?:\\d+|${NUMBERS})\\s+(?:years?|months?|weeks?|days?|hours?))\\b`,
      'gi',
    ),
    category: 'prepositions',
    suggest: (g) => `${matchCase(g[0], 'for')} ${g[1]}`,
    explanation_en:
      'Use "for" with a period of time and "since" with a starting point.',
    translation_uk: '«For» – для тривалості, «since» – для моменту початку.',
  },
  {
    pattern: /\bI\s+have\s+(\d+)\s+years(?:\s+old)?\b/gi,
    category: 'l1_calque',
    suggest: (g) => `I am ${g[0]} years old`,
    explanation_en: 'In English age is expressed with "to be", not "to have".',
    translation_uk: 'Вік виражається дієсловом «be», а не «have».',
  },
  {
    pattern: new RegExp(
      `\\b((?:${PAST_MARKER}),?\\s+I)\\s+(go|see|meet|work|visit|buy|make|take|do|have|want|like|play|watch)\\b`,
      'gi',
    ),
    category: 'verb_tense',
    suggest: (g) => `${g[0]} ${pastTense(g[1])}`,
    explanation_en:
      'Use the past simple for finished actions with a past time marker.',
    translation_uk:
      'Для завершених дій з маркером минулого вживається Past Simple.',
  },
  {
    pattern: /\b(informations|advices)\b/gi,
    category: 'plural_countable',
    suggest: (g) => g[0].slice(0, -1),
    explanation_en:
      '"Information" and "advice" are uncountable and have no plural.',
    translation_uk: '«Information» і «advice» – незлічувані, множини не мають.',
  },
  {
    pattern: /\b(make)\s+(a\s+photo|photos)\b/gi,
    category: 'collocation',
    suggest: (g) => `${matchCase(g[0], 'take')} ${g[1]}`,
    explanation_en: 'We "take" photos, we do not "make" them.',
    translation_uk: 'Фото «беруть» (take), а не «роблять» (make).',
  },
  {
    pattern: /\b(why)\s+(you)\s+(think|want|like|need|say)\b/gi,
    category: 'question_form',
    suggest: (g) => `${g[0]} do ${g[1]} ${g[2]}`,
    explanation_en: 'In questions add "do" before the subject.',
    translation_uk: 'У питаннях перед підметом потрібне допоміжне «do».',
  },
  {
    pattern: /\bI\s+very\s+(like|love|enjoy)\b/gi,
    category: 'word_order',
    suggest: (g) => `I really ${g[0]}`,
    explanation_en:
      '"Very" does not go before a verb; use "really" or "very much" after the object.',
    translation_uk:
      '«Very» не ставиться перед дієсловом; вживайте «really» або «very much».',
  },
  {
    pattern:
      /\b(I|he|she|it|we|they)\s+(busy|tired|ready|late|happy|hungry|interested)\b/gi,
    category: 'missing_be',
    suggest: (g) => `${g[0]} ${beForm(g[0])} ${g[1]}`,
    explanation_en: 'An adjective after the subject needs the verb "be".',
    translation_uk: 'Після підмета перед прикметником потрібне дієслово «be».',
  },
  {
    pattern: /\b(if)\s+(I|you|he|she|it|we|they)\s+will\s+([a-z]+)\b/gi,
    category: 'conditionals',
    suggest: (g) => {
      const subject = g[1].toLowerCase();
      const third = ['he', 'she', 'it'].includes(subject);
      const verb =
        g[2].toLowerCase() === 'be'
          ? beForm(subject)
          : third
            ? thirdPerson(g[2])
            : g[2];
      return `${g[0]} ${g[1]} ${verb}`;
    },
    explanation_en:
      'After "if" in a real condition use the present simple, not "will".',
    translation_uk:
      'Після «if» у реальній умові вживається Present Simple, а не «will».',
  },
  {
    pattern: /\b(depends?)\s+of\b/gi,
    category: 'prepositions',
    suggest: (g) => `${g[0]} on`,
    explanation_en: 'The verb "depend" takes the preposition "on".',
    translation_uk: 'Дієслово «depend» вживається з прийменником «on».',
  },
  {
    pattern: new RegExp(`\\b(in)\\s+(${DAYS})\\b`, 'gi'),
    category: 'prepositions',
    suggest: (g) => `${matchCase(g[0], 'on')} ${g[1]}`,
    explanation_en: 'Use "on" with days of the week.',
    translation_uk: 'З днями тижня вживається «on».',
  },
  {
    pattern:
      /\b(with|in|on|at|for)\s+(small|big|new|large|good|nice)\s+(team|project|company|office|job)\b/gi,
    category: 'articles',
    suggest: (g) => `${g[0]} a ${g[1]} ${g[2]}`,
    explanation_en: 'A singular countable noun needs an article.',
    translation_uk: 'Злічуваному іменнику в однині потрібен артикль.',
  },
  {
    pattern: /\bI\s+(am|was)\s+boring\b/gi,
    category: 'word_choice',
    suggest: (g) => `I ${g[0]} bored`,
    explanation_en:
      '"Boring" describes a thing that causes the feeling; "bored" describes how you feel.',
    translation_uk:
      '«Boring» – те, що викликає нудьгу; «bored» – як почувається людина.',
  },
];
