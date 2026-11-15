import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { authorization } from './fixtures.js';

export interface WordRecord {
  lemma: string;
  state: string;
}

export interface ReportRecord {
  answers: number;
  words: WordRecord[];
}

function isWordRecord(value: unknown): value is WordRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lemma' in value &&
    typeof value.lemma === 'string' &&
    'state' in value &&
    typeof value.state === 'string'
  );
}

export async function readReport(
  request: APIRequestContext,
  accessToken: string,
  sessionId: string,
): Promise<ReportRecord> {
  const response = await request.get(`/api/sessions/${sessionId}/report`, {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'read report').toBe(200);
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('answers' in body) ||
    typeof body.answers !== 'number' ||
    !('words' in body) ||
    !Array.isArray(body.words) ||
    !body.words.every(isWordRecord)
  ) {
    throw new Error('report response has an unexpected shape');
  }
  return {
    answers: body.answers,
    words: body.words.map(({ lemma, state }) => ({ lemma, state })),
  };
}

export async function readWordStates(
  request: APIRequestContext,
  accessToken: string,
): Promise<Record<string, string>> {
  const response = await request.get('/api/words', {
    headers: authorization(accessToken),
  });
  expect(response.status(), 'list words').toBe(200);
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('items' in body) ||
    !Array.isArray(body.items) ||
    !body.items.every(isWordRecord)
  ) {
    throw new Error('words response has an unexpected shape');
  }
  return Object.fromEntries(
    body.items.map(({ lemma, state }) => [lemma, state]),
  );
}

export type Mark = 'Не знав' | 'Частково' | 'Знав';

export function markGroup(scope: Page | Locator, lemma: string): Locator {
  return scope.getByRole('radiogroup', {
    name: `Позначка для слова ${lemma}`,
    exact: true,
  });
}

export function markOption(
  scope: Page | Locator,
  lemma: string,
  mark: Mark,
): Locator {
  return markGroup(scope, lemma).getByRole('radio', {
    name: mark,
    exact: true,
  });
}

export async function markWord(
  scope: Page | Locator,
  lemma: string,
  mark: Mark,
): Promise<void> {
  // The radio input is visually hidden inside the segmented control; the tap goes to its label.
  await markGroup(scope, lemma).getByText(mark, { exact: true }).click();
  await expect(markOption(scope, lemma, mark)).toBeChecked();
}

export function sessionWords(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: 'Нові слова сесії' }),
  });
}
