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
  throw new Error('parseEnv did not throw');
}

describe('parseEnv', () => {
  it('[TC-00-06] a minimal valid env gets default values', () => {
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

  it('[TC-00-06] string values from .env are coerced to types, empty ones are treated as unset', () => {
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

  it('[TC-00-06] missing DATABASE_URL error names the variable', () => {
    expect(errorOf({})).toContain('DATABASE_URL');
  });

  it('[TC-00-06] empty DATABASE_URL (as in .env.example) names the variable', () => {
    expect(errorOf({ DATABASE_URL: '' })).toContain('DATABASE_URL');
  });

  it('[TC-00-06] non-postgres DATABASE_URL names the variable', () => {
    expect(errorOf({ DATABASE_URL: 'mysql://x' })).toContain('DATABASE_URL');
  });

  it('[TC-00-06] invalid PORT names the variable', () => {
    expect(errorOf({ ...validEnv, PORT: 'abc' })).toContain('PORT');
    expect(errorOf({ ...validEnv, PORT: '70000' })).toContain('PORT');
  });

  it('[TC-00-06] invalid LOG_LEVEL names the variable', () => {
    expect(errorOf({ ...validEnv, LOG_LEVEL: 'loud' })).toContain('LOG_LEVEL');
  });

  it('[TC-00-06] unknown provider names the variable', () => {
    expect(errorOf({ ...validEnv, STT_PROVIDER: 'whisper' })).toContain(
      'STT_PROVIDER',
    );
    expect(errorOf({ ...validEnv, LLM_PROVIDER: 'gpt' })).toContain(
      'LLM_PROVIDER',
    );
  });

  it('[TC-00-06] STT_PROVIDER=deepgram gives a "not implemented" error', () => {
    const message = errorOf({ ...validEnv, STT_PROVIDER: 'deepgram' });
    expect(message).toContain('STT_PROVIDER');
    expect(message).toContain('not implemented');
  });

  it('[TC-00-06] LLM_PROVIDER=gemini gives a "not implemented" error', () => {
    const message = errorOf({ ...validEnv, LLM_PROVIDER: 'gemini' });
    expect(message).toContain('LLM_PROVIDER');
    expect(message).toContain('not implemented');
  });

  it('[TC-00-06] DEV_KEEP_AUDIO=true without DEV_AUDIO_DIR names DEV_AUDIO_DIR', () => {
    expect(errorOf({ ...validEnv, DEV_KEEP_AUDIO: 'true' })).toContain(
      'DEV_AUDIO_DIR',
    );
  });

  it('[TC-00-06] all invalid variables are listed in one message', () => {
    const message = errorOf({ PORT: 'abc', LOG_LEVEL: 'loud' });
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });
});
