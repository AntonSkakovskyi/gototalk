import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from '../../integrations/language-model/fake-language-model.js';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import type { LanguageModelPort } from '../../integrations/language-model/language-model.port.js';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';

const SENTINEL = 'SENTINEL-user-text-do-not-log';
const TEXT = 'Yesterday I go home';
const META = { promptVersion: 'error-analysis.v1', model: 'test-model' };

function rawMistake(overrides: Record<string, unknown> = {}) {
  return {
    start: 10,
    end: 14,
    original: 'I go',
    suggestion: 'I went',
    category: 'verb_tense',
    explanation_en: 'Use the past simple.',
    translation_uk: 'Використовуйте минулий час.',
    ...overrides,
  };
}

function portWith(analyzeUtterance: unknown): LanguageModelPort {
  return { analyzeUtterance } as unknown as LanguageModelPort;
}

function setup(...outputs: unknown[]) {
  const analyzeUtterance = vi.fn();
  for (const output of outputs) {
    analyzeUtterance.mockResolvedValueOnce({ output, ...META });
  }
  return {
    analyzeUtterance,
    service: new MistakeAnalyzerService(portWith(analyzeUtterance)),
  };
}

function silenceWarnings() {
  return vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MistakeAnalyzerService.analyze', () => {
  it('[TC-04-01] returns aligned mistakes with the response metadata', async () => {
    const { service, analyzeUtterance } = setup({
      mistakes: [rawMistake({ start: 0, end: 4 })],
      better: [{ original: 'I go', better: 'I went' }],
    });

    const outcome = await service.analyze(TEXT);

    expect(analyzeUtterance).toHaveBeenCalledWith({ text: TEXT });
    expect(outcome).toMatchObject({ status: 'done', ...META });
    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.mistakes).toEqual([rawMistake()]);
    expect(outcome.better).toEqual([{ original: 'I go', better: 'I went' }]);
  });

  it('[TC-04-01] drops an item with a foreign category without failing', async () => {
    const warn = silenceWarnings();
    const { service } = setup({
      mistakes: [rawMistake({ category: 'made_up' }), rawMistake()],
      better: [],
    });

    const outcome = await service.analyze(TEXT);

    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.mistakes).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      { invalid: 1, unaligned: 0 },
      expect.any(String),
    );
  });

  it('[TC-04-01] drops items with an empty original, end before start and too long text', async () => {
    silenceWarnings();
    const { service } = setup({
      mistakes: [
        rawMistake({ original: '' }),
        rawMistake({ start: 14, end: 10 }),
        rawMistake({ original: 'x'.repeat(201) }),
      ],
      better: [],
    });

    const outcome = await service.analyze(TEXT);

    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.mistakes).toEqual([]);
  });

  it('[TC-04-01] drops a mistake whose original is not in the text', async () => {
    const warn = silenceWarnings();
    const { service } = setup({
      mistakes: [rawMistake({ original: 'she work', end: 18 })],
      better: [],
    });

    const outcome = await service.analyze(TEXT);

    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.mistakes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      { invalid: 0, unaligned: 1 },
      expect.any(String),
    );
  });

  it('[TC-04-01] retries once after an invalid envelope and then succeeds', async () => {
    silenceWarnings();
    const { service, analyzeUtterance } = setup(
      { mistakes: 'broken' },
      { mistakes: [rawMistake()], better: [] },
    );

    const outcome = await service.analyze(TEXT);

    expect(analyzeUtterance).toHaveBeenCalledTimes(2);
    expect(outcome.status).toBe('done');
  });

  it('[TC-04-02] returns failed with metadata after two invalid envelopes', async () => {
    silenceWarnings();
    const { service, analyzeUtterance } = setup(
      { mistakes: 'broken' },
      { better: 1 },
    );

    await expect(service.analyze(TEXT)).resolves.toEqual({
      status: 'failed',
      ...META,
    });
    expect(analyzeUtterance).toHaveBeenCalledTimes(2);
  });

  it('[TC-04-02] propagates an unavailable language model', async () => {
    const service = new MistakeAnalyzerService(
      portWith(vi.fn().mockRejectedValue(new LanguageModelUnavailableError())),
    );

    await expect(service.analyze(TEXT)).rejects.toBeInstanceOf(
      LanguageModelUnavailableError,
    );
  });

  it('[TC-04-02] propagates unexpected errors unchanged', async () => {
    const failure = new Error('boom');
    const service = new MistakeAnalyzerService(
      portWith(vi.fn().mockRejectedValue(failure)),
    );

    await expect(service.analyze(TEXT)).rejects.toBe(failure);
  });

  it('[TC-04-01] caps better at 2 and drops invalid better items', async () => {
    const warn = silenceWarnings();
    const better = (n: number) => ({ original: `o${n}`, better: `b${n}` });
    const { service } = setup({
      mistakes: [],
      better: [{ original: '', better: 'x' }, better(1), better(2), better(3)],
    });

    const outcome = await service.analyze(TEXT);

    if (outcome.status !== 'done') throw new Error('expected done');
    expect(outcome.better).toEqual([better(1), better(2)]);
    expect(warn).toHaveBeenCalledWith(
      { invalid: 1, unaligned: 0 },
      expect.any(String),
    );
  });

  it('[TC-04-01] does not log anything when all items are kept', async () => {
    const warn = silenceWarnings();
    const { service } = setup({ mistakes: [rawMistake()], better: [] });

    await service.analyze(TEXT);

    expect(warn).not.toHaveBeenCalled();
  });

  it('[TC-04-01] logs counts but never the user text or model values', async () => {
    const warn = silenceWarnings();
    const { service } = setup({
      mistakes: [
        rawMistake({ category: 'made_up', original: SENTINEL }),
        rawMistake({ original: `${SENTINEL}-missing`, end: 30 }),
      ],
      better: [{ original: '', better: SENTINEL }],
    });

    await service.analyze(`I go ${SENTINEL}`);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-04-01] Fake adapter: a verb_tense mistake with a correct slice', async () => {
    const service = new MistakeAnalyzerService(new FakeLanguageModel());
    const text = 'Yesterday I go to the office';

    const outcome = await service.analyze(text);

    if (outcome.status !== 'done') throw new Error('expected done');
    const mistake = outcome.mistakes.find((m) => m.category === 'verb_tense');
    expect(mistake).toBeDefined();
    expect(text.slice(mistake?.start, mistake?.end)).toBe(mistake?.original);
    expect(outcome).toMatchObject({
      promptVersion: 'error-analysis.v1',
      model: 'fake',
    });
  });

  it('[TC-04-02] Fake adapter: invalid_json ends in failed', async () => {
    silenceWarnings();
    const service = new MistakeAnalyzerService(
      new FakeLanguageModel({ failMode: 'invalid_json' }),
    );

    await expect(service.analyze(TEXT)).resolves.toEqual({
      status: 'failed',
      promptVersion: 'error-analysis.v1',
      model: 'fake',
    });
  });
});
