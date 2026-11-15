import { TurnSchema } from '../model-output.js';
import { describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from './fake-language-model.js';
import { LanguageModelUnavailableError } from '../language-model.errors.js';
import type { NextTurnInput } from '../language-model.port.js';
import { renderNextTurnPrompt } from '../prompts/prompt-registry.js';

vi.mock('../prompts/prompt-registry.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../prompts/prompt-registry.js')>();
  return {
    ...actual,
    renderNextTurnPrompt: vi.fn(actual.renderNextTurnPrompt),
  };
});

const llm = new FakeLanguageModel();

const exhausted = (lastAnswer: string): NextTurnInput => ({
  topic: 'Work',
  remainingQuestions: [],
  history: [
    { role: 'assistant', text: 'What do you do?' },
    { role: 'user', text: lastAnswer },
  ],
});

const question = async (input: NextTurnInput) =>
  TurnSchema.parse(await llm.nextTurn(input)).question;

describe('FakeLanguageModel.nextTurn', () => {
  it('[TC-04-01] returns the first remaining plan question', async () => {
    const result = await llm.nextTurn({
      topic: 'Work',
      remainingQuestions: ['Second?', 'Third?'],
      history: [{ role: 'user', text: 'I like my project' }],
    });

    expect(TurnSchema.parse(result)).toEqual({ question: 'Second?' });
  });

  it('[TC-04-01] asks about the last word of the last user answer when the plan is exhausted', async () => {
    expect(await question(exhausted('I like my project'))).toBe(
      'Can you tell me more about "project"?',
    );
  });

  it('[TC-04-01] strips punctuation from the last word', async () => {
    expect(await question(exhausted('I enjoy my meetings!'))).toBe(
      'Can you tell me more about "meetings"?',
    );
    expect(await question(exhausted('It was (really) great...'))).toBe(
      'Can you tell me more about "great"?',
    );
  });

  it('[TC-04-01] walks back to the nearest word longer than 3 letters', async () => {
    expect(await question(exhausted('I like football and it is fun'))).toBe(
      'Can you tell me more about "football"?',
    );
    expect(await question(exhausted('I like my job, it is ok.'))).toBe(
      'Can you tell me more about "like"?',
    );
  });

  it('[TC-04-01] ignores assistant entries after the last user answer', async () => {
    const result = await question({
      topic: 'Work',
      remainingQuestions: [],
      history: [
        { role: 'user', text: 'I like cooking' },
        { role: 'assistant', text: 'Can you tell me more about "cooking"?' },
      ],
    });

    expect(result).toBe('Can you tell me more about "cooking"?');
  });

  it('[TC-04-01] falls back to "that" when no word is longer than 3 letters', async () => {
    const generic = 'Can you tell me more about that?';
    expect(await question(exhausted('I do it, ok?'))).toBe(generic);
    expect(await question(exhausted('...'))).toBe(generic);
    expect(await question(exhausted(''))).toBe(generic);
  });

  it('[TC-04-01] falls back to "that" for an empty history or one without user answers', async () => {
    const generic = 'Can you tell me more about that?';
    expect(
      await question({ topic: 'Work', remainingQuestions: [], history: [] }),
    ).toBe(generic);
    expect(
      await question({
        topic: 'Work',
        remainingQuestions: [],
        history: [{ role: 'assistant', text: 'What is your project about?' }],
      }),
    ).toBe(generic);
  });

  it('[TC-04-01] keeps the question within the schema limit for a very long word', async () => {
    const result = await question(exhausted(`I like ${'a'.repeat(400)}`));

    expect(result.length).toBeLessThanOrEqual(300);
    expect(result.startsWith('Can you tell me more about "')).toBe(true);
  });

  it('[TC-00-05] is deterministic', async () => {
    const input = exhausted('I like my project');

    expect(await llm.nextTurn(input)).toEqual(await llm.nextTurn(input));
  });

  it('[TC-04-07] renders the next-turn prompt as part of the call', async () => {
    vi.mocked(renderNextTurnPrompt).mockClear();
    const input = exhausted('I like my project');

    await llm.nextTurn(input);

    expect(renderNextTurnPrompt).toHaveBeenCalledWith(input);
  });

  it('[TC-04-07] a broken prompt makes nextTurn reject', async () => {
    vi.mocked(renderNextTurnPrompt).mockImplementationOnce(() => {
      throw new Error('Prompt "next-turn.v1" not found');
    });

    await expect(llm.nextTurn(exhausted('I like it'))).rejects.toThrow(
      /not found/,
    );
  });

  it('[TC-04-08] unavailable: rejects without rendering the prompt', async () => {
    vi.mocked(renderNextTurnPrompt).mockClear();
    const down = new FakeLanguageModel({ failMode: 'unavailable' });

    await expect(down.nextTurn(exhausted('I like it'))).rejects.toBeInstanceOf(
      LanguageModelUnavailableError,
    );
    expect(renderNextTurnPrompt).not.toHaveBeenCalled();
  });
});
