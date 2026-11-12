import { describe, expect, it } from 'vitest';
import {
  AnalysisResultSchema,
  HintSchema,
  PlanSchema,
  SummarySchema,
  TranscriptSchema,
  TurnSchema,
} from '@gototalk/shared';
import { FakeLanguageModel } from './fake-language-model.js';
import type { LanguageModelPort } from '../../ports/language-model.port.js';
import type { SpeechRecognitionPort } from '../../ports/speech-recognition.port.js';
import { FakeSpeechRecognition } from './fake-speech-recognition.js';

const audio = Buffer.from([1, 2, 3]);

// Через інтерфейс порту, як це робить доменний код
const fakeStt = (): SpeechRecognitionPort => new FakeSpeechRecognition();

describe('FakeSpeechRecognition', () => {
  it('[TC-00-05] transcribe: однаковий вхід дає ідентичний результат', async () => {
    const stt = fakeStt();
    const first = await stt.transcribe(audio, 'audio/webm');
    const second = await stt.transcribe(audio, 'audio/webm');

    expect(second).toEqual(first);
    expect(TranscriptSchema.parse(first)).toEqual(first);
  });

  it('[TC-00-05] transcribe повертає транскрипт №0 зі stubs.md і ігнорує вміст аудіо та index', async () => {
    const stt = fakeStt();
    const result = await stt.transcribe(Buffer.alloc(0), 'audio/ogg', 3);

    expect(result.verbatim).toBe(
      'Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job.',
    );
    expect(result.clean).toBe(
      'Yesterday I go to the office and I have a meeting with my team. I very like my job.',
    );
  });
});

describe('FakeLanguageModel', () => {
  const llm: LanguageModelPort = new FakeLanguageModel();

  it('[TC-00-05] analyzeUtterance: детермінований, проходить Zod, verb_tense і word_order', async () => {
    const { verbatim } = await fakeStt().transcribe(audio, 'audio/webm');
    const first = await llm.analyzeUtterance({ text: verbatim });
    const second = await llm.analyzeUtterance({ text: verbatim });

    expect(second).toEqual(first);
    expect(AnalysisResultSchema.parse(first)).toEqual(first);
    expect(first.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    expect(first.better.length).toBeGreaterThan(0);
  });

  it('[TC-00-05] analyzeUtterance: text.slice(start, end) === original', async () => {
    const { verbatim } = await fakeStt().transcribe(audio, 'audio/webm');
    const { mistakes } = await llm.analyzeUtterance({ text: verbatim });

    expect(mistakes).toHaveLength(2);
    for (const m of mistakes) {
      expect(verbatim.slice(m.start, m.end)).toBe(m.original);
    }
  });

  it('[TC-00-05] analyzeUtterance: на тексті без збігів повертає порожній список, а не хибні позиції', async () => {
    const result = await llm.analyzeUtterance({ text: 'Hello there.' });
    expect(result).toEqual({ mistakes: [], better: [] });
  });

  it('[TC-00-05] planSession, nextTurn, hint, summarizeSession: детерміновані й проходять Zod', async () => {
    const plan = await llm.planSession({
      level: 'A2',
      scenes: ['work'],
      patterns: [],
      previousTopics: [],
    });
    expect(
      await llm.planSession({
        level: 'A2',
        scenes: ['work'],
        patterns: [],
        previousTopics: [],
      }),
    ).toEqual(plan);
    expect(PlanSchema.parse(plan)).toEqual(plan);

    const turnInput = { plan, history: [] };
    const turn = await llm.nextTurn(turnInput);
    expect(await llm.nextTurn(turnInput)).toEqual(turn);
    expect(TurnSchema.parse(turn)).toEqual(turn);

    for (const request of [
      { kind: 'phrase_start', question: 'Why?' },
      { kind: 'translation', word: 'зустріч' },
    ] as const) {
      const hint = await llm.hint(request);
      expect(await llm.hint(request)).toEqual(hint);
      expect(HintSchema.parse(hint)).toEqual(hint);
      expect(hint.kind).toBe(request.kind);
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

  it('[TC-00-05] виклик не змінює наступні відповіді (мутація результату не протікає)', async () => {
    const first = await llm.planSession({
      level: 'A2',
      scenes: [],
      patterns: [],
      previousTopics: [],
    });
    first.questions[0] = 'mutated';
    const second = await llm.planSession({
      level: 'A2',
      scenes: [],
      patterns: [],
      previousTopics: [],
    });
    expect(second.questions[0]).not.toBe('mutated');
  });
});
