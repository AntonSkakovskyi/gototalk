import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { FakeLanguageModel } from './language-model/fake-language-model.js';
import { FakeSpeechRecognition } from './speech-recognition/fake-speech-recognition.js';
import { LANGUAGE_MODEL_PORT } from './language-model/language-model.port.js';
import type { LanguageModelPort } from './language-model/language-model.port.js';
import { SPEECH_RECOGNITION_PORT } from './speech-recognition/speech-recognition.port.js';
import type { SpeechRecognitionPort } from './speech-recognition/speech-recognition.port.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789abcdef',
  LOG_LEVEL: 'silent',
};

describe('ProvidersModule', () => {
  it('[TC-00-05] STT_PROVIDER=fake and LLM_PROVIDER=fake give the fake adapters', async () => {
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

  it('[TC-00-05] without provider variables the fake adapters are chosen by default', async () => {
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
