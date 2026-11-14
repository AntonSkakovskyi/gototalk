import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import { vi } from 'vitest';
import { PG_POOL } from '../../src/core/db/db.tokens.js';
import { SPEECH_RECOGNITION_PORT } from '../../src/integrations/speech-recognition/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../../src/integrations/speech-recognition/speech-recognition.port.js';
import { isolateEnv } from './env.js';
import { createTestApp } from './test-app.js';

/** An app whose speech recognition calls are recorded; process.env is restored on close. */
export async function createVoiceApp(env: Record<string, string> = {}) {
  const restoreEnv = isolateEnv();
  // ConfigService reads process.env before the validated env, so the overrides must be there
  Object.assign(process.env, env);
  const app = await createTestApp({ env });
  const speech = app.get<SpeechRecognitionPort>(SPEECH_RECOGNITION_PORT);
  const transcribe = vi.fn(speech.transcribe.bind(speech));
  speech.transcribe = transcribe;
  const close = async () => {
    await app.close();
    restoreEnv();
  };
  return { app, pool: app.get<pg.Pool>(PG_POOL), transcribe, close };
}

export type VoiceApp = Awaited<ReturnType<typeof createVoiceApp>>;

export function multipartRequest(
  app: INestApplication,
  token: string,
  sessionId: string,
) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${sessionId}/utterances`)
    .set('Authorization', `Bearer ${token}`);
}
