import { PlanSchema } from '@gototalk/shared';
import { TurnSchema } from './language-model/model-output.js';
import { AnalysisResultSchema } from './testing/analysis-result-schema.js';
import { describe, expect, it } from 'vitest';
import { FakeLanguageModel } from './language-model/fake-language-model.js';
import { LanguageModelUnavailableError } from './language-model/language-model.errors.js';
import type { LanguageModelPort } from './language-model/language-model.port.js';
import { FakeSpeechRecognition } from './speech-recognition/fake-speech-recognition.js';
import type { SpeechRecognitionPort } from './speech-recognition/speech-recognition.port.js';
import { SpeechRecognitionUnavailableError } from './speech-recognition/speech-recognition.errors.js';

const audio = Buffer.from([1, 2, 3]);
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

describe('FakeSpeechRecognition fail modes', () => {
  it('[TC-04-08] unavailable: transcribe rejects with SpeechRecognitionUnavailableError', async () => {
    const stt: SpeechRecognitionPort = new FakeSpeechRecognition({
      failMode: 'unavailable',
    });

    const error: unknown = await stt
      .transcribe(audio, 'audio/webm')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SpeechRecognitionUnavailableError);
    expect((error as Error).name).toBe('SpeechRecognitionUnavailableError');
  });

  it('[TC-00-05] without a fail mode transcribe keeps working', async () => {
    const stt: SpeechRecognitionPort = new FakeSpeechRecognition({});

    const transcript = await stt.transcribe(audio, 'audio/webm');

    expect(transcript.verbatim).toContain('yesterday I go');
  });
});

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
