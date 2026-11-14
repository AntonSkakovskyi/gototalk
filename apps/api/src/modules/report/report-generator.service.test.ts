import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import type {
  LanguageModelPort,
  SummarizeSessionInput,
} from '../../integrations/language-model/language-model.port.js';
import { ReportGeneratorService } from './report-generator.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const SENTINEL = 'SENTINEL-user-text-do-not-log';
const PROMPT_VERSION = 'session-summary.v1';

const category = (code: string, count: number) => ({
  category: code,
  titleUk: `title ${code}`,
  count,
});

const CATEGORIES = [
  category('articles', 5),
  category('verb_tense', 4),
  category('collocation', 3),
  category('other', 2),
];

const EXAMPLES = new Map([
  [
    'articles',
    [
      { original: `${SENTINEL} a`, suggestion: 'the a' },
      { original: 'b', suggestion: 'the b' },
    ],
  ],
]);

const modelResponse = (output: unknown, model = 'fake') => ({
  output,
  promptVersion: PROMPT_VERSION,
  model,
});

const storedRow = (summary: string) => ({
  summary,
  promptVersion: PROMPT_VERSION,
  model: 'fake',
});

function setup(options: { answers?: number; complete?: boolean } = {}) {
  const { answers = 3, complete = true } = options;
  const findStoredSummary = vi.fn().mockResolvedValue(null);
  const stats = vi.fn().mockResolvedValue({ answers, durationSeconds: 125 });
  const categories = vi.fn().mockResolvedValue(CATEGORIES);
  const examples = vi.fn().mockResolvedValue(EXAMPLES);
  const saveSummary = vi.fn().mockResolvedValue(undefined);
  const completePending = vi.fn().mockResolvedValue(complete);
  const summarizeSession = vi
    .fn<LanguageModelPort['summarizeSession']>()
    .mockResolvedValue(modelResponse({ summary: 'Good job' }));
  const service = new ReportGeneratorService(
    { findStoredSummary, stats, categories, examples, saveSummary },
    { complete: completePending },
    { summarizeSession },
  );
  return {
    service,
    findStoredSummary,
    stats,
    categories,
    examples,
    saveSummary,
    completePending,
    summarizeSession,
  };
}

function mockWarn() {
  return vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReportGeneratorService.ensure', () => {
  it('[TC-05-02] returns the stored summary without pending analysis or a model call', async () => {
    const fixture = setup();
    fixture.findStoredSummary.mockResolvedValue(storedRow('Stored text'));

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'ready',
      text: 'Stored text',
    });

    expect(fixture.findStoredSummary).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(fixture.completePending).not.toHaveBeenCalled();
    expect(fixture.summarizeSession).not.toHaveBeenCalled();
    expect(fixture.saveSummary).not.toHaveBeenCalled();
  });

  it('[TC-05-02] reports no answers without calling the model', async () => {
    const fixture = setup({ answers: 0 });

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'no_answers',
    });

    expect(fixture.completePending).not.toHaveBeenCalled();
    expect(fixture.summarizeSession).not.toHaveBeenCalled();
    expect(fixture.saveSummary).not.toHaveBeenCalled();
  });

  it('[TC-05-02] is unavailable when pending analyses are not complete', async () => {
    const fixture = setup({ complete: false });

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'unavailable',
    });

    expect(fixture.completePending).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(fixture.summarizeSession).not.toHaveBeenCalled();
    expect(fixture.saveSummary).not.toHaveBeenCalled();
  });

  it('[TC-05-02] saves the summary with the prompt version and model and returns the stored text', async () => {
    const fixture = setup();
    fixture.findStoredSummary
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedRow('Good job'));

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'ready',
      text: 'Good job',
    });

    expect(fixture.saveSummary).toHaveBeenCalledWith(USER_ID, SESSION_ID, {
      summary: 'Good job',
      promptVersion: PROMPT_VERSION,
      model: 'fake',
    });
    expect(fixture.summarizeSession).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-02] returns the text of the winner when another writer saved first', async () => {
    const fixture = setup();
    fixture.findStoredSummary
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedRow('Winner text'));

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'ready',
      text: 'Winner text',
    });
    expect(fixture.saveSummary).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-02] is unavailable when the stored summary vanished after saving', async () => {
    const fixture = setup();

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('[TC-05-02] sends only the top three categories with the minutes and the repository examples to the model', async () => {
    const fixture = setup();

    await fixture.service.ensure(USER_ID, SESSION_ID);

    expect(fixture.stats).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(fixture.categories).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(fixture.examples).toHaveBeenCalledWith(USER_ID, SESSION_ID, [
      'articles',
      'verb_tense',
      'collocation',
    ]);
    const input: SummarizeSessionInput | undefined =
      fixture.summarizeSession.mock.calls[0]?.[0];
    expect(input).toEqual({
      answers: 3,
      minutes: 2,
      categories: [
        {
          code: 'articles',
          title: 'title articles',
          count: 5,
          examples: [
            { original: `${SENTINEL} a`, suggestion: 'the a' },
            { original: 'b', suggestion: 'the b' },
          ],
        },
        {
          code: 'verb_tense',
          title: 'title verb_tense',
          count: 4,
          examples: [],
        },
        {
          code: 'collocation',
          title: 'title collocation',
          count: 3,
          examples: [],
        },
      ],
    });
  });

  it('[TC-05-02] is unavailable and saves nothing when the model is unavailable', async () => {
    const warn = mockWarn();
    const fixture = setup();
    fixture.summarizeSession.mockRejectedValue(
      new LanguageModelUnavailableError(),
    );

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'unavailable',
    });

    expect(fixture.saveSummary).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-05-02] is unavailable after two invalid outputs and saves nothing', async () => {
    const warn = mockWarn();
    const fixture = setup();
    fixture.summarizeSession.mockResolvedValue(modelResponse({ summary: 123 }));

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'unavailable',
    });

    expect(fixture.summarizeSession).toHaveBeenCalledTimes(2);
    expect(fixture.saveSummary).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-05-02] retries once after an invalid output and saves the valid one with the last model', async () => {
    const fixture = setup();
    fixture.findStoredSummary
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedRow('Second try'));
    fixture.summarizeSession
      .mockResolvedValueOnce(modelResponse({ summary: 123 }))
      .mockResolvedValueOnce(
        modelResponse({ summary: 'Second try' }, 'retry-model'),
      );
    mockWarn();

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).resolves.toEqual({
      status: 'ready',
      text: 'Second try',
    });

    expect(fixture.summarizeSession).toHaveBeenCalledTimes(2);
    expect(fixture.saveSummary).toHaveBeenCalledWith(USER_ID, SESSION_ID, {
      summary: 'Second try',
      promptVersion: PROMPT_VERSION,
      model: 'retry-model',
    });
  });

  it('[TC-05-02] rethrows an unexpected model error', async () => {
    const fixture = setup();
    fixture.summarizeSession.mockRejectedValue(new Error('boom'));

    await expect(fixture.service.ensure(USER_ID, SESSION_ID)).rejects.toThrow(
      'boom',
    );

    expect(fixture.saveSummary).not.toHaveBeenCalled();
  });
});
