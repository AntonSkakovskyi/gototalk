import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema } from '../testing/analysis-result-schema.js';
import { PlanSchema } from '@gototalk/shared';
import { HintSchema, SummarySchema, TurnSchema } from '../model-output.js';
import { ERROR_ANALYSIS_PROMPT_ID } from '../prompts/prompt-registry.js';
import { FakeLanguageModel } from './fake-language-model.js';
import { LanguageModelUnavailableError } from '../language-model.errors.js';
import type { LanguageModelPort } from '../language-model.port.js';
import { FakeSpeechRecognition } from '../../speech-recognition/fake/fake-speech-recognition.js';
import type { SpeechRecognitionPort } from '../../speech-recognition/speech-recognition.port.js';

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

const TEXT = 'yesterday I go to the office';

const planInput = {
  level: 'A2',
  scenes: ['work'],
  goals: [],
  patterns: [],
  previousTopics: [],
};
const turnInput = { topic: 'Work', remainingQuestions: ['q1'], history: [] };
const sessionInput = { answers: 1, minutes: 1, categories: [] };

function everyMethod(llm: LanguageModelPort): Promise<unknown>[] {
  return [
    llm.analyzeUtterance({ text: TEXT }),
    llm.planSession(planInput),
    llm.nextTurn(turnInput),
    llm.hint({ kind: 'phrase_start', question: 'Why?', questionNumber: 1 }),
    llm.hint({ kind: 'translation', word: 'зустріч' }),
    llm.summarizeSession(sessionInput),
  ];
}

describe('FakeLanguageModel fail modes', () => {
  it('[TC-04-08] unavailable: every method rejects with LanguageModelUnavailableError', async () => {
    const llm: LanguageModelPort = new FakeLanguageModel({
      failMode: 'unavailable',
    });

    const outcomes = await Promise.allSettled(everyMethod(llm));

    expect(outcomes).toHaveLength(6);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected');
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(
        LanguageModelUnavailableError,
      );
    }
  });

  it('[TC-04-08] the unavailability error has a generic name and message', () => {
    const error = new LanguageModelUnavailableError();

    expect(error.name).toBe('LanguageModelUnavailableError');
    expect(error.message).not.toContain(TEXT);
  });

  it('[TC-04-08] invalid_json: analyzeUtterance returns an output the analysis schema rejects', async () => {
    const llm: LanguageModelPort = new FakeLanguageModel({
      failMode: 'invalid_json',
    });

    const { output, promptVersion, model } = await llm.analyzeUtterance({
      text: TEXT,
    });

    expect(AnalysisResultSchema.safeParse(output).success).toBe(false);
    expect(promptVersion).toBe('error-analysis.v1');
    expect(model).toBe('fake');
  });

  it('[TC-04-08] invalid_json: the other methods work, so a failed analysis can be followed by a next question', async () => {
    const llm: LanguageModelPort = new FakeLanguageModel({
      failMode: 'invalid_json',
    });

    expect(PlanSchema.safeParse(await llm.planSession(planInput)).success).toBe(
      true,
    );
    expect(TurnSchema.safeParse(await llm.nextTurn(turnInput)).success).toBe(
      true,
    );
    await expect(
      llm.hint({ kind: 'translation', word: 'зустріч' }),
    ).resolves.toBeDefined();
    await expect(llm.summarizeSession(sessionInput)).resolves.toBeDefined();
  });

  it('[TC-00-05] an empty options object behaves as no failure', async () => {
    const llm: LanguageModelPort = new FakeLanguageModel({});

    const { output } = await llm.analyzeUtterance({ text: TEXT });

    expect(AnalysisResultSchema.safeParse(output).success).toBe(true);
  });
});
