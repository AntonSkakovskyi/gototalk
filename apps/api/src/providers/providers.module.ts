import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../core/config/env.schema.js';
import { FakeLanguageModel } from '../adapters/fake/fake-language-model.js';
import { FakeSpeechRecognition } from '../adapters/fake/fake-speech-recognition.js';
import { LANGUAGE_MODEL_PORT } from '../ports/language-model.port.js';
import type { LanguageModelPort } from '../ports/language-model.port.js';
import { SPEECH_RECOGNITION_PORT } from '../ports/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../ports/speech-recognition.port.js';

// Adding a real provider widens the type, so this exhaustive check fails to compile until a branch is added
function unsupported(name: string, value: never): never {
  throw new Error(`${name}="${String(value)}" has no adapter registered`);
}

@Global()
@Module({
  providers: [
    {
      provide: SPEECH_RECOGNITION_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SpeechRecognitionPort => {
        const provider = config.get('STT_PROVIDER', { infer: true });
        switch (provider) {
          case 'fake':
            return new FakeSpeechRecognition();
          default:
            return unsupported('STT_PROVIDER', provider);
        }
      },
    },
    {
      provide: LANGUAGE_MODEL_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LanguageModelPort => {
        const provider = config.get('LLM_PROVIDER', { infer: true });
        switch (provider) {
          case 'fake':
            return new FakeLanguageModel();
          default:
            return unsupported('LLM_PROVIDER', provider);
        }
      },
    },
  ],
  exports: [SPEECH_RECOGNITION_PORT, LANGUAGE_MODEL_PORT],
})
export class ProvidersModule {}
