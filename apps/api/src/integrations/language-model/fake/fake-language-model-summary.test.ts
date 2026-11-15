import { SummarySchema } from '../model-output.js';
import { describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from './fake-language-model.js';
import { LanguageModelUnavailableError } from '../language-model.errors.js';
import type { SummarizeSessionInput } from '../language-model.port.js';
import {
  renderSessionSummaryPrompt,
  SESSION_SUMMARY_PROMPT_ID,
} from '../prompts/prompt-registry.js';

vi.mock('../prompts/prompt-registry.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../prompts/prompt-registry.js')>();
  return {
    ...actual,
    renderSessionSummaryPrompt: vi.fn(actual.renderSessionSummaryPrompt),
  };
});

const llm = new FakeLanguageModel();

const input: SummarizeSessionInput = {
  answers: 3,
  minutes: 5,
  categories: [
    {
      code: 'verb_tense',
      title: 'Часи дієслів',
      count: 2,
      examples: [{ original: 'I go', suggestion: 'I went' }],
    },
  ],
};

describe('FakeLanguageModel.summarizeSession', () => {
  it('[TC-05-04] renders the summary prompt as part of the call', async () => {
    vi.mocked(renderSessionSummaryPrompt).mockClear();

    await llm.summarizeSession(input);

    expect(renderSessionSummaryPrompt).toHaveBeenCalledWith(input);
  });

  it('[TC-05-04] a broken prompt makes summarizeSession reject', async () => {
    vi.mocked(renderSessionSummaryPrompt).mockImplementationOnce(() => {
      throw new Error('Prompt "session-summary.v1" not found');
    });

    await expect(llm.summarizeSession(input)).rejects.toThrow(/not found/);
  });

  it('[TC-05-04] returns a valid summary with the prompt version and fake model', async () => {
    const response = await llm.summarizeSession(input);

    expect(SummarySchema.parse(response.output).summary).toContain(
      'Часи дієслів',
    );
    expect(response.promptVersion).toBe(SESSION_SUMMARY_PROMPT_ID);
    expect(response.model).toBe('fake');
  });

  it('[TC-04-08] unavailable: rejects without rendering the prompt', async () => {
    vi.mocked(renderSessionSummaryPrompt).mockClear();
    const down = new FakeLanguageModel({ failMode: 'unavailable' });

    await expect(down.summarizeSession(input)).rejects.toBeInstanceOf(
      LanguageModelUnavailableError,
    );
    expect(renderSessionSummaryPrompt).not.toHaveBeenCalled();
  });

  it('[TC-04-08] invalid_json does not affect summarizeSession', async () => {
    const broken = new FakeLanguageModel({ failMode: 'invalid_json' });

    const { output } = await broken.summarizeSession(input);

    expect(SummarySchema.safeParse(output).success).toBe(true);
  });
});
