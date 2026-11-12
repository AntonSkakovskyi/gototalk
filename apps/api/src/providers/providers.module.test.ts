import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { FakeLanguageModel } from '../adapters/fake/fake-language-model.js';
import { FakeSpeechRecognition } from '../adapters/fake/fake-speech-recognition.js';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type { LanguageModelPort } from '../ports/language-model.port.js';
import { SPEECH_RECOGNITION_PORT } from '../ports/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../ports/speech-recognition.port.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  LOG_LEVEL: 'silent',
};

describe('ProvidersModule', () => {
  it('[TC-00-05] STT_PROVIDER=fake і LLM_PROVIDER=fake дають Fake-адаптери', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.register({
          env: { ...env, STT_PROVIDER: 'fake', LLM_PROVIDER: 'fake' },
        }),
      ],
    }).compile();

    expect(
      moduleRef.get<SpeechRecognitionPort>(SPEECH_RECOGNITION_PORT),
    ).toBeInstanceOf(FakeSpeechRecognition);
    expect(
      moduleRef.get<LanguageModelPort>(LANGUAGE_MODEL_PORT),
    ).toBeInstanceOf(FakeLanguageModel);

    await moduleRef.close();
  });

  it('[TC-00-05] без змінних провайдерів за замовчуванням обираються Fake-адаптери', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    expect(
      moduleRef.get<SpeechRecognitionPort>(SPEECH_RECOGNITION_PORT),
    ).toBeInstanceOf(FakeSpeechRecognition);
    expect(
      moduleRef.get<LanguageModelPort>(LANGUAGE_MODEL_PORT),
    ).toBeInstanceOf(FakeLanguageModel);

    await moduleRef.close();
  });
});
