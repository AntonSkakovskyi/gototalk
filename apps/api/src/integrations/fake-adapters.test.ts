import { describe, expect, it } from 'vitest';
import {
  AnalysisResultSchema,
  HintSchema,
  PlanSchema,
  SummarySchema,
  TranscriptSchema,
  TurnSchema,
} from '@gototalk/shared';
import { ERROR_ANALYSIS_PROMPT_ID } from './language-model/prompts.js';
import { FakeLanguageModel } from './language-model/fake-language-model.js';
import type { LanguageModelPort } from './language-model/language-model.port.js';
import type { SpeechRecognitionPort } from './speech-recognition/speech-recognition.port.js';
import { FAKE_TRANSCRIPTS } from './speech-recognition/fake-transcripts.js';
import { FakeSpeechRecognition } from './speech-recognition/fake-speech-recognition.js';

const audio = Buffer.from([1, 2, 3]);

const fakeStt = (): SpeechRecognitionPort => new FakeSpeechRecognition();

describe('FakeSpeechRecognition', () => {
  it('[TC-00-05] transcribe: the same index gives an identical result', async () => {
    const stt = fakeStt();
    const first = await stt.transcribe(audio, 'audio/webm', 2);
    const second = await stt.transcribe(audio, 'audio/webm', 2);

    expect(second).toEqual(first);
    expect(TranscriptSchema.parse(first)).toEqual(first);
  });

  it('[TC-00-05] transcribe: a fresh adapter starts with transcript #0 and ignores the audio content', async () => {
    const result = await fakeStt().transcribe(Buffer.alloc(0), 'audio/ogg');

    expect(result.verbatim).toBe(FAKE_TRANSCRIPTS[0]);
    expect(result.clean).toBe(
      'Yesterday I go to the office and I have a meeting with my team. I very like my job.',
    );
  });
});

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
      mistakes: [{ category: 'verb_tense' as const }],
    };
    const summary = await llm.summarizeSession(sessionInput);
    expect(await llm.summarizeSession(sessionInput)).toEqual(summary);
    expect(SummarySchema.parse(summary)).toEqual(summary);
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
