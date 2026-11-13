import { AnalysisResultSchema } from '../testing/analysis-result-schema.js';
import { describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from './fake-language-model.js';
import {
  ERROR_ANALYSIS_PROMPT_ID,
  renderErrorAnalysisPrompt,
} from './prompts.js';

vi.mock('./prompts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./prompts.js')>();
  return {
    ...actual,
    renderErrorAnalysisPrompt: vi.fn(actual.renderErrorAnalysisPrompt),
  };
});

const llm = new FakeLanguageModel();

describe('FakeLanguageModel.analyzeUtterance', () => {
  it('[TC-04-01] returns the rule-engine output with the prompt id and the fake model', async () => {
    const response = await llm.analyzeUtterance({
      text: 'Yesterday I go home. I very like it.',
    });

    const result = AnalysisResultSchema.parse(response.output);
    expect(result.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    expect(response.promptVersion).toBe(ERROR_ANALYSIS_PROMPT_ID);
    expect(response.model).toBe('fake');
  });

  it('[TC-04-07] renders the error analysis prompt as part of the call', async () => {
    vi.mocked(renderErrorAnalysisPrompt).mockClear();

    await llm.analyzeUtterance({ text: 'Hello there.' });

    expect(renderErrorAnalysisPrompt).toHaveBeenCalledWith({
      text: 'Hello there.',
    });
  });

  it('[TC-04-07] a broken prompt makes analyzeUtterance reject', async () => {
    vi.mocked(renderErrorAnalysisPrompt).mockImplementationOnce(() => {
      throw new Error('Prompt "error-analysis.v1" not found');
    });

    await expect(llm.analyzeUtterance({ text: 'Hi.' })).rejects.toThrow(
      /not found/,
    );
  });
});
