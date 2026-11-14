import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { postAudio, webmAudio } from './support/audio.js';
import { startLearner } from './support/dialogue-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

describe('audio retention', () => {
  let audioDir: string;
  let started: INestApplication | undefined;
  let envKeys: string[] = [];

  beforeEach(async () => {
    audioDir = await mkdtemp(path.join(tmpdir(), 'gototalk-audio-'));
  });

  afterEach(async () => {
    await started?.close();
    started = undefined;
    // ConfigModule copies the validated env into process.env, which would leak into the next app
    for (const key of envKeys) delete process.env[key];
    envKeys = [];
    await rm(audioDir, { recursive: true, force: true });
  });

  async function startApp(env: Record<string, string>) {
    envKeys = Object.keys(env);
    const app = await createTestApp({ env });
    started = app;
    const pool = app.get<pg.Pool>(PG_POOL);
    await resetUserData(pool);
    return { app, pool };
  }

  it('[TC-04-13] writes no audio to disk and the schema has no bytea column when DEV_KEEP_AUDIO is off', async () => {
    const { app, pool } = await startApp({ DEV_AUDIO_DIR: audioDir });
    const learner = await startLearner(app);

    const res = await postAudio(app, learner.token, learner.session.id);

    expect(res.status).toBe(201);
    expect(await readdir(audioDir)).toEqual([]);
    const { rows } = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'bytea'`,
    );
    expect(rows).toEqual([]);
  });

  it('[TC-04-13] writes exactly the uploaded bytes to DEV_AUDIO_DIR when DEV_KEEP_AUDIO is on', async () => {
    const { app } = await startApp({
      NODE_ENV: 'development',
      DEV_KEEP_AUDIO: 'true',
      DEV_AUDIO_DIR: audioDir,
    });
    const learner = await startLearner(app);
    const bytes = webmAudio(256);

    const res = await postAudio(app, learner.token, learner.session.id, {
      bytes,
    });

    expect(res.status).toBe(201);
    expect(await readdir(audioDir)).toEqual([`${res.body.id}.webm`]);
    expect(await readFile(path.join(audioDir, `${res.body.id}.webm`))).toEqual(
      bytes,
    );
  });
});
