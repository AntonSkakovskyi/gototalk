import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseEnv, validateAudioDir } from './env.schema.js';
import { findRepoRoot } from './repo-root.js';

const validEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789abcdef',
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
      JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET,
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

  it('[TC-00-06] missing or empty JWT_ACCESS_SECRET names the variable', () => {
    expect(errorOf({ DATABASE_URL: validEnv.DATABASE_URL })).toContain(
      'JWT_ACCESS_SECRET',
    );
    expect(errorOf({ ...validEnv, JWT_ACCESS_SECRET: '' })).toContain(
      'JWT_ACCESS_SECRET',
    );
  });

  it('[TC-00-06] JWT_ACCESS_SECRET shorter than 32 characters names the variable', () => {
    const message = errorOf({ ...validEnv, JWT_ACCESS_SECRET: 'x'.repeat(31) });
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).toContain('32');
    expect(() =>
      parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
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

  it('[TC-00-06] DEV_KEEP_AUDIO=true is rejected outside development', () => {
    for (const NODE_ENV of ['test', 'production']) {
      expect(
        errorOf({
          ...validEnv,
          NODE_ENV,
          DEV_KEEP_AUDIO: 'true',
          DEV_AUDIO_DIR: 'C:/tmp/gototalk-audio',
        }),
      ).toContain('DEV_KEEP_AUDIO');
    }
  });

  it('[TC-00-06] DEV_AUDIO_DIR must be an absolute path', () => {
    for (const DEV_AUDIO_DIR of ['audio', './audio', '../audio']) {
      expect(
        errorOf({ ...validEnv, DEV_KEEP_AUDIO: 'true', DEV_AUDIO_DIR }),
      ).toContain('DEV_AUDIO_DIR');
    }
  });

  it('[TC-00-06] absolute posix and windows DEV_AUDIO_DIR values are accepted', () => {
    for (const DEV_AUDIO_DIR of [
      '/var/tmp/gototalk-audio',
      String.raw`C:\tmp\audio`,
    ]) {
      expect(
        parseEnv({ ...validEnv, DEV_KEEP_AUDIO: 'true', DEV_AUDIO_DIR })
          .DEV_AUDIO_DIR,
      ).toBe(DEV_AUDIO_DIR);
    }
  });

  describe('DEV_AUDIO_DIR location', () => {
    const repoRoot = findRepoRoot(process.cwd());
    const audioEnv = (DEV_AUDIO_DIR: string) => ({
      ...validEnv,
      DEV_KEEP_AUDIO: 'true',
      DEV_AUDIO_DIR,
    });
    const temporaryDirs: string[] = [];

    afterEach(() => {
      for (const dir of temporaryDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('[TC-04-13] the test runs inside a repository', () => {
      expect(repoRoot).toBeDefined();
    });

    it('[TC-04-13] a directory inside the repository root is rejected', () => {
      const message = errorOf(audioEnv(path.join(repoRoot!, 'tmp-audio')));
      expect(message).toContain('DEV_AUDIO_DIR');
      expect(message).toContain('outside the repository');
    });

    it('[TC-04-13] the repository root itself is rejected', () => {
      expect(errorOf(audioEnv(repoRoot!))).toContain('outside the repository');
    });

    it('[TC-04-13] a sibling directory sharing the root name prefix is accepted', () => {
      const sibling = `${repoRoot}-audio`;
      expect(parseEnv(audioEnv(sibling)).DEV_AUDIO_DIR).toBe(sibling);
    });

    it('[TC-04-13] a temporary directory outside the repository is accepted', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'gototalk-audio-'));
      temporaryDirs.push(dir);
      expect(parseEnv(audioEnv(dir)).DEV_AUDIO_DIR).toBe(dir);
    });

    it('[TC-04-13] the location is not checked when DEV_KEEP_AUDIO is false', () => {
      const env = parseEnv({
        ...validEnv,
        DEV_AUDIO_DIR: path.join(repoRoot!, 'tmp-audio'),
      });
      expect(env.DEV_KEEP_AUDIO).toBe(false);
    });

    it('[TC-04-13] a path of the other platform flavour is never inside the repository', () => {
      const foreign = path.sep === '/' ? 'C:/tmp/audio' : '/var/tmp/audio';
      expect(validateAudioDir(true, foreign, repoRoot)).toBeUndefined();
    });

    it('[TC-04-13] no extra check when the repository root is unknown', () => {
      const inside = path.join(repoRoot!, 'tmp-audio');
      expect(validateAudioDir(true, inside, undefined)).toBeUndefined();
      expect(validateAudioDir(true, inside, repoRoot)).toContain(
        'outside the repository',
      );
    });
  });

  it('[TC-00-06] all invalid variables are listed in one message', () => {
    const message = errorOf({ PORT: 'abc', LOG_LEVEL: 'loud' });
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });

  it('[TC-00-05] fail modes are parsed from the allowed values', () => {
    const env = parseEnv({
      ...validEnv,
      FAKE_STT_FAIL: 'unavailable',
      FAKE_LLM_FAIL: 'invalid_json',
    });

    expect(env.FAKE_STT_FAIL).toBe('unavailable');
    expect(env.FAKE_LLM_FAIL).toBe('invalid_json');
    expect(
      parseEnv({ ...validEnv, FAKE_LLM_FAIL: 'unavailable' }),
    ).toMatchObject({ FAKE_LLM_FAIL: 'unavailable' });
  });

  it('[TC-00-05] empty or missing fail modes are unset', () => {
    const empty = parseEnv({
      ...validEnv,
      FAKE_STT_FAIL: '',
      FAKE_LLM_FAIL: '',
    });

    expect(empty.FAKE_STT_FAIL).toBeUndefined();
    expect(empty.FAKE_LLM_FAIL).toBeUndefined();
    expect(parseEnv(validEnv).FAKE_LLM_FAIL).toBeUndefined();
  });

  it('[TC-00-05] unknown fail modes name the variable', () => {
    expect(errorOf({ ...validEnv, FAKE_STT_FAIL: '1' })).toContain(
      'FAKE_STT_FAIL',
    );
    expect(errorOf({ ...validEnv, FAKE_STT_FAIL: 'invalid_json' })).toContain(
      'FAKE_STT_FAIL',
    );
    expect(errorOf({ ...validEnv, FAKE_LLM_FAIL: 'boom' })).toContain(
      'FAKE_LLM_FAIL',
    );
  });
});
