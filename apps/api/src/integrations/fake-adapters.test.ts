import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema } from './testing/analysis-result-schema.js';
import { PlanSchema } from '@gototalk/shared';
import {
  HintSchema,
  SummarySchema,
  TurnSchema,
} from './language-model/model-output.js';
import { ERROR_ANALYSIS_PROMPT_ID } from './language-model/prompts.js';
import { FakeLanguageModel } from './language-model/fake-language-model.js';
import type { LanguageModelPort } from './language-model/language-model.port.js';
import { FakeSpeechRecognition } from './speech-recognition/fake/fake-speech-recognition.js';
import type { SpeechRecognitionPort } from './speech-recognition/speech-recognition.port.js';

const audio = Buffer.from([1, 2, 3]);

const fakeStt = (): SpeechRecognitionPort => new FakeSpeechRecognition();

describe('FakeLanguageModel', () => {
  const llm: LanguageModelPort = new FakeLanguageModel();
  const analyze = async (text: string) => {
    const { output } = await llm.analyzeUtterance({ text });
    return AnalysisResultSchema.parse(output);
  };

  it('[TC-00-05] analyzeUtterance: deterministic, passes Zod, verb_tense and word_order', async () => {
    const { verbatim } = await fakeStt().transcribe(audio, 'audio/webm');
    const first = await analyze(verbatim);
    const second = await analyze(verbatim);

    expect(second).toEqual(first);
    expect(first.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    expect(first.better.length).toBeGreaterThan(0);
  });

  it('[TC-00-05] analyzeUtterance: text.slice(start, end) === original', async () => {
    const { verbatim } = await fakeStt().transcribe(audio, 'audio/webm');
    const { mistakes } = await analyze(verbatim);

    expect(mistakes).toHaveLength(2);
    for (const m of mistakes) {
      expect(verbatim.slice(m.start, m.end)).toBe(m.original);
    }
  });

  it('[TC-00-05] analyzeUtterance reports the prompt id as version and the fake model name', async () => {
    const response = await llm.analyzeUtterance({ text: 'Hello there.' });

    expect(response.promptVersion).toBe(ERROR_ANALYSIS_PROMPT_ID);
    expect(response.model).toBe('fake');
  });

  it('[TC-00-05] analyzeUtterance: text without matches gives an empty list, not false positions', async () => {
    const result = await analyze('Hello there.');
    expect(result).toEqual({ mistakes: [], better: [] });
  });

  it('[TC-00-05] planSession, nextTurn, hint, summarizeSession: deterministic and pass Zod', async () => {
    const planInput = {
      level: 'A2',
      scenes: ['work'],
      goals: [],
      patterns: [],
      previousTopics: [],
    };
    const plan = PlanSchema.parse(await llm.planSession(planInput));
    expect(await llm.planSession(planInput)).toEqual(plan);

    const turnInput = {
      topic: plan.topic,
      remainingQuestions: plan.questions,
      history: [],
    };
    const turn = await llm.nextTurn(turnInput);
    expect(await llm.nextTurn(turnInput)).toEqual(turn);
    expect(TurnSchema.parse(turn)).toEqual(turn);
    expect(TurnSchema.parse(await llm.nextTurn(turnInput))).toEqual(turn);

    for (const request of [
      { kind: 'phrase_start', question: 'Why?', questionNumber: 1 },
      { kind: 'translation', word: 'зустріч' },
    ] as const) {
      const hint = await llm.hint(request);
      expect(await llm.hint(request)).toEqual(hint);
      expect(HintSchema.parse(hint)).toEqual(hint);
      expect(HintSchema.parse(hint).kind).toBe(request.kind);
    }

    const sessionInput = {
      answers: 3,
      minutes: 5,
      categories: [
        {
          code: 'verb_tense' as const,
          title: 'Часи дієслів',
          count: 1,
          examples: [{ original: 'I go', suggestion: 'I went' }],
        },
      ],
    };
    const summary = await llm.summarizeSession(sessionInput);
    expect(await llm.summarizeSession(sessionInput)).toEqual(summary);
    expect(SummarySchema.parse(summary.output)).toEqual(summary.output);
  });

  it('[TC-00-05] a call does not affect later answers (mutating a result does not leak)', async () => {
    const first = PlanSchema.parse(
      await llm.planSession({
        level: 'A2',
        scenes: [],
        goals: [],
        patterns: [],
        previousTopics: [],
      }),
    );
    first.questions[0] = 'mutated';
    const second = PlanSchema.parse(
      await llm.planSession({
        level: 'A2',
        scenes: [],
        goals: [],
        patterns: [],
        previousTopics: [],
      }),
    );
    expect(second.questions[0]).not.toBe('mutated');
  });
});
