import { REPORT_SUMMARY_MAX, TOP_CATEGORIES_LIMIT } from '@gototalk/shared';
import type { Summary } from '../model-output.js';
import type { SummarizeSessionInput } from '../language-model.port.js';

const PLURALS = new Intl.PluralRules('uk');
const TIMES: Record<string, string> = {
  one: 'раз',
  few: 'рази',
  many: 'разів',
  other: 'разів',
};
const COMPACT_TITLE_LENGTH = 50;

const compact = (title: string): string =>
  title.length > COMPACT_TITLE_LENGTH
    ? `${title.slice(0, COMPACT_TITLE_LENGTH - 1)}…`
    : title;

function render(
  { answers, minutes }: SummarizeSessionInput,
  titles: string[],
): string {
  const [first] = titles;
  const head = `Ви відповіли ${answers} ${TIMES[PLURALS.select(answers)]} за ${minutes} хв.`;
  if (first === undefined) return `${head} Помилок не знайдено, так тримати.`;
  const found =
    titles.length === 1
      ? `Найчастіша помилка: ${first}.`
      : `Найчастіші помилки: ${titles.join(', ')}.`;
  return `${head} ${found} Зосередьтеся на категорії «${first}» у наступній сесії.`;
}

export function buildSummary(input: SummarizeSessionInput): Summary {
  const titles = input.categories
    .slice(0, TOP_CATEGORIES_LIMIT)
    .map((category) => category.title);
  const full = render(input, titles);
  return {
    summary:
      full.length <= REPORT_SUMMARY_MAX
        ? full
        : render(input, titles.map(compact)),
  };
}
