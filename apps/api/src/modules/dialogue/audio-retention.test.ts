import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../core/config/env.schema.js';
import { AudioRetention } from './audio-retention.js';

const UTTERANCE_ID = '44444444-4444-4444-8444-444444444444';
const AUDIO = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);

function retention(settings: Partial<Env>): AudioRetention {
  const config = { get: (key: keyof Env) => settings[key] };
  return new AudioRetention(config as unknown as ConfigService<Env, true>);
}

describe('AudioRetention', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'gototalk-audio-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('[TC-04-13] writes nothing when DEV_KEEP_AUDIO is off', async () => {
    await retention({ DEV_KEEP_AUDIO: false, DEV_AUDIO_DIR: dir }).keep(
      UTTERANCE_ID,
      'audio/webm',
      AUDIO,
    );

    expect(await readdir(dir)).toEqual([]);
  });

  it('[TC-04-13] writes the received bytes to DEV_AUDIO_DIR when DEV_KEEP_AUDIO is on', async () => {
    await retention({ DEV_KEEP_AUDIO: true, DEV_AUDIO_DIR: dir }).keep(
      UTTERANCE_ID,
      'audio/webm',
      AUDIO,
    );

    expect(await readdir(dir)).toEqual([`${UTTERANCE_ID}.webm`]);
    expect(await readFile(path.join(dir, `${UTTERANCE_ID}.webm`))).toEqual(
      AUDIO,
    );
  });

  it.each([
    ['audio/webm', 'webm'],
    ['audio/ogg', 'ogg'],
    ['audio/mp4', 'm4a'],
  ] as const)(
    '[TC-04-13] names the %s copy with the .%s extension',
    async (mime, extension) => {
      await retention({ DEV_KEEP_AUDIO: true, DEV_AUDIO_DIR: dir }).keep(
        UTTERANCE_ID,
        mime,
        AUDIO,
      );

      expect(await readdir(dir)).toEqual([`${UTTERANCE_ID}.${extension}`]);
    },
  );

  it('[TC-04-13] creates the directory when it does not exist', async () => {
    const nested = path.join(dir, 'a', 'b');

    await retention({ DEV_KEEP_AUDIO: true, DEV_AUDIO_DIR: nested }).keep(
      UTTERANCE_ID,
      'audio/ogg',
      AUDIO,
    );

    expect(await readdir(nested)).toHaveLength(1);
  });

  it('[TC-04-13] does not throw when the copy cannot be written', async () => {
    const blocker = path.join(dir, 'file');
    await writeFile(blocker, 'x');

    await expect(
      retention({ DEV_KEEP_AUDIO: true, DEV_AUDIO_DIR: blocker }).keep(
        UTTERANCE_ID,
        'audio/webm',
        AUDIO,
      ),
    ).resolves.toBeUndefined();
  });

  it('[TC-04-13] logs only the error code when the copy cannot be written, never the path', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const blocker = path.join(dir, 'secret-blocker');
    await writeFile(blocker, 'x');

    await retention({ DEV_KEEP_AUDIO: true, DEV_AUDIO_DIR: blocker }).keep(
      UTTERANCE_ID,
      'audio/webm',
      AUDIO,
    );

    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('Could not write the development audio copy');
    expect(logged).toMatch(/E[A-Z]+/);
    expect(logged).not.toContain('secret-blocker');
    expect(logged).not.toContain(UTTERANCE_ID);
    warn.mockRestore();
  });
});
