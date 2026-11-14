import type { Hint } from '@gototalk/shared';
import type { HintInput } from './language-model.port.js';

const PHRASE_STARTS: readonly [string, ...string[]] = [
  'I think that…',
  'In my opinion…',
  'One thing I remember is…',
  'Last time I…',
  'For me, the most important thing is…',
];

const DICTIONARY = new Map<string, string>([
  ['зустріч', 'meeting'],
  ['термін', 'deadline'],
  ['розклад', 'schedule'],
  ['колега', 'colleague'],
  ['співбесіда', 'interview'],
  ['квиток', 'ticket'],
  ['бронювання', 'booking'],
  ['готель', 'hotel'],
  ['лікар', 'doctor'],
  ['квартира', 'flat'],
  ['орендувати', 'rent'],
  ['замовлення', 'order'],
  ['проблема', 'problem'],
  ['проєкт', 'project'],
  ['команда', 'team'],
  ['досвід', 'experience'],
  ['навичка', 'skill'],
  ['вміти', 'be able to'],
  ['звільнитися', 'quit'],
  ['зарплата', 'salary'],
  ['відпустка', 'holiday'],
  ['подорож', 'trip'],
  ['погода', 'weather'],
  ['вихідні', 'weekend'],
  ['сніданок', 'breakfast'],
  ['вечеря', 'dinner'],
  ['зупинка', 'stop'],
  ['потяг', 'train'],
  ['літак', 'plane'],
  ['аеропорт', 'airport'],
  ['валіза', 'suitcase'],
  ['допомога', 'help'],
  ['рішення', 'decision'],
  ['відповідь', 'answer'],
  ['питання', 'question'],
  ['вибачте', 'sorry'],
  ['будь ласка', 'please'],
  ['дякую', 'thank you'],
  ['відгук', 'feedback'],
]);

const normalize = (word: string): string =>
  word.trim().replace(/\s+/g, ' ').toLowerCase();

export function buildFakeHint(input: HintInput): Hint {
  if (input.kind === 'phrase_start') {
    const index =
      ((input.questionNumber % PHRASE_STARTS.length) + PHRASE_STARTS.length) %
      PHRASE_STARTS.length;
    return {
      kind: 'phrase_start',
      text: PHRASE_STARTS[index] ?? PHRASE_STARTS[0],
    };
  }
  return {
    kind: 'translation',
    word: DICTIONARY.get(normalize(input.word)) ?? null,
  };
}
