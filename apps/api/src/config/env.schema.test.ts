import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.schema.js';

const validEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk',
};

function errorOf(env: Record<string, unknown>): string {
  try {
    parseEnv(env);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('parseEnv не кинув помилку');
}

describe('parseEnv', () => {
  it('[TC-00-06] валідний мінімальний env отримує значення за замовчуванням', () => {
    expect(parseEnv(validEnv)).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL: validEnv.DATABASE_URL,
      PORT: 3000,
      LOG_LEVEL: 'info',
      STT_PROVIDER: 'fake',
      LLM_PROVIDER: 'fake',
      DEV_KEEP_AUDIO: false,
    });
  });

  it('[TC-00-06] рядкові значення з .env приводяться до типів, порожні трактуються як незадані', () => {
    const env = parseEnv({
      ...validEnv,
      TEST_DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
      PORT: '4100',
      LOG_LEVEL: 'debug',
      FAKE_STT_FAIL: '',
      FAKE_LLM_FAIL: '',
      DEV_KEEP_AUDIO: 'true',
      DEV_AUDIO_DIR: 'C:/tmp/gototalk-audio',
    });

    expect(env.PORT).toBe(4100);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.FAKE_STT_FAIL).toBeUndefined();
    expect(env.DEV_KEEP_AUDIO).toBe(true);
    expect(env.DEV_AUDIO_DIR).toBe('C:/tmp/gototalk-audio');
  });

  it('[TC-00-06] без DATABASE_URL помилка називає змінну', () => {
    expect(errorOf({})).toContain('DATABASE_URL');
  });

  it('[TC-00-06] порожній DATABASE_URL (як у .env.example) називає змінну', () => {
    expect(errorOf({ DATABASE_URL: '' })).toContain('DATABASE_URL');
  });

  it('[TC-00-06] DATABASE_URL не у форматі postgres називає змінну', () => {
    expect(errorOf({ DATABASE_URL: 'mysql://x' })).toContain('DATABASE_URL');
  });

  it('[TC-00-06] невалідний PORT називає змінну', () => {
    expect(errorOf({ ...validEnv, PORT: 'abc' })).toContain('PORT');
    expect(errorOf({ ...validEnv, PORT: '70000' })).toContain('PORT');
  });

  it('[TC-00-06] невалідний LOG_LEVEL називає змінну', () => {
    expect(errorOf({ ...validEnv, LOG_LEVEL: 'loud' })).toContain('LOG_LEVEL');
  });

  it('[TC-00-06] невідомий провайдер називає змінну', () => {
    expect(errorOf({ ...validEnv, STT_PROVIDER: 'whisper' })).toContain(
      'STT_PROVIDER',
    );
    expect(errorOf({ ...validEnv, LLM_PROVIDER: 'gpt' })).toContain(
      'LLM_PROVIDER',
    );
  });

  it('[TC-00-06] STT_PROVIDER=deepgram дає помилку «not implemented»', () => {
    const message = errorOf({ ...validEnv, STT_PROVIDER: 'deepgram' });
    expect(message).toContain('STT_PROVIDER');
    expect(message).toContain('not implemented');
  });

  it('[TC-00-06] LLM_PROVIDER=gemini дає помилку «not implemented»', () => {
    const message = errorOf({ ...validEnv, LLM_PROVIDER: 'gemini' });
    expect(message).toContain('LLM_PROVIDER');
    expect(message).toContain('not implemented');
  });

  it('[TC-00-06] DEV_KEEP_AUDIO=true без DEV_AUDIO_DIR називає DEV_AUDIO_DIR', () => {
    expect(errorOf({ ...validEnv, DEV_KEEP_AUDIO: 'true' })).toContain(
      'DEV_AUDIO_DIR',
    );
  });

  it('[TC-00-06] усі невалідні змінні перелічено в одному повідомленні', () => {
    const message = errorOf({ PORT: 'abc', LOG_LEVEL: 'loud' });
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });
});
