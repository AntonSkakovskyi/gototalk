import { HintSchema } from './model-output.js';
import { describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from './fake-language-model.js';
import { LanguageModelUnavailableError } from './language-model.errors.js';
import type { HintInput } from './language-model.port.js';
import { renderHintPrompt } from './prompts/prompt-registry.js';

vi.mock('./prompts/prompt-registry.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./prompts/prompt-registry.js')>();
  return {
    ...actual,
    renderHintPrompt: vi.fn(actual.renderHintPrompt),
  };
});

const llm = new FakeLanguageModel();

const phraseStart = (questionNumber: number): HintInput => ({
  kind: 'phrase_start',
  question: 'What do you do at work?',
  questionNumber,
});

const translate = async (word: string) =>
  HintSchema.parse(await llm.hint({ kind: 'translation', word }));

describe('FakeLanguageModel.hint phrase_start', () => {
  it.each([
    [0, 'I think that…'],
    [1, 'In my opinion…'],
    [2, 'One thing I remember is…'],
    [3, 'Last time I…'],
    [4, 'For me, the most important thing is…'],
    [5, 'I think that…'],
    [7, 'One thing I remember is…'],
    [14, 'For me, the most important thing is…'],
  ])(
    '[TC-04-01] question number %i gives the start by mod 5',
    async (n, text) => {
      expect(HintSchema.parse(await llm.hint(phraseStart(n)))).toEqual({
        kind: 'phrase_start',
        text,
      });
    },
  );

  it('[TC-04-01] never fails on a negative question number', async () => {
    expect(HintSchema.parse(await llm.hint(phraseStart(-1)))).toEqual({
      kind: 'phrase_start',
      text: 'For me, the most important thing is…',
    });
  });

  it('[TC-00-05] is deterministic', async () => {
    expect(await llm.hint(phraseStart(3))).toEqual(
      await llm.hint(phraseStart(3)),
    );
  });
});

describe('FakeLanguageModel.hint translation', () => {
  it.each([
    ['зустріч', 'meeting'],
    ['термін', 'deadline'],
    ['будь ласка', 'please'],
    ['вміти', 'be able to'],
    ['відгук', 'feedback'],
  ])('[TC-04-01] translates %s to %s', async (word, english) => {
    expect(await translate(word)).toEqual({
      kind: 'translation',
      word: english,
    });
  });

  it('[TC-04-01] ignores case, surrounding spaces and repeated inner spaces', async () => {
    expect(await translate('  ЗУСТРІЧ ')).toEqual({
      kind: 'translation',
      word: 'meeting',
    });
    expect(await translate('Будь   ласка')).toEqual({
      kind: 'translation',
      word: 'please',
    });
  });

  it('[TC-04-01] returns a null word without a message for an unknown word', async () => {
    const result = await llm.hint({ kind: 'translation', word: 'динозавр' });

    expect(result).toEqual({ kind: 'translation', word: null });
    expect(HintSchema.parse(result)).toEqual(result);
  });

  it('[TC-04-01] does not translate English or inherited object keys', async () => {
    for (const word of ['meeting', 'constructor', '__proto__', '']) {
      expect(await translate(word)).toEqual({
        kind: 'translation',
        word: null,
      });
    }
  });
});

describe('FakeLanguageModel.hint prompt and failure modes', () => {
  it('[TC-04-07] renders the hint prompt as part of the call', async () => {
    vi.mocked(renderHintPrompt).mockClear();
    const input = phraseStart(1);

    await llm.hint(input);

    expect(renderHintPrompt).toHaveBeenCalledWith(input);
  });

  it('[TC-04-07] renders the hint prompt for a translation without a question', async () => {
    vi.mocked(renderHintPrompt).mockClear();
    const input: HintInput = { kind: 'translation', word: 'зустріч' };

    await llm.hint(input);

    expect(renderHintPrompt).toHaveBeenCalledWith(input);
  });

  it('[TC-04-07] a broken prompt makes hint reject', async () => {
    vi.mocked(renderHintPrompt).mockImplementationOnce(() => {
      throw new Error('Prompt "hint.v1" not found');
    });

    await expect(llm.hint(phraseStart(1))).rejects.toThrow(/not found/);
  });

  it('[TC-04-08] unavailable: rejects without rendering the prompt', async () => {
    vi.mocked(renderHintPrompt).mockClear();
    const down = new FakeLanguageModel({ failMode: 'unavailable' });

    await expect(down.hint(phraseStart(1))).rejects.toBeInstanceOf(
      LanguageModelUnavailableError,
    );
    expect(renderHintPrompt).not.toHaveBeenCalled();
  });

  it('[TC-04-08] invalid_json does not affect hint', async () => {
    const broken = new FakeLanguageModel({ failMode: 'invalid_json' });

    expect(
      HintSchema.parse(
        await broken.hint({ kind: 'translation', word: 'дякую' }),
      ),
    ).toEqual({ kind: 'translation', word: 'thank you' });
  });
});
