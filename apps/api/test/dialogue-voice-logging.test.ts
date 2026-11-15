import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_TRANSCRIPTS } from '../src/integrations/speech-recognition/fake/fake-transcripts.js';
import { postAudio } from './support/audio.js';
import { captureLogs } from './support/capture-logs.js';
import { startLearner } from './support/dialogue-flow.js';
import { createVoiceApp } from './support/voice-app.js';
import type { VoiceApp } from './support/voice-app.js';
import { resetUserData } from './support/test-db.js';

const AUDIO_MARKER = 'AUDIO-PAYLOAD-MARKER-7f3a9c';
const AUDIO_BYTES = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  Buffer.from(AUDIO_MARKER),
]);

describe('voice answer logging', () => {
  let ctx: VoiceApp;
  let logs: ReturnType<typeof captureLogs> | undefined;

  afterEach(async () => {
    logs?.restore();
    logs = undefined;
    await ctx.close();
  });

  async function start(env: Record<string, string>) {
    ctx = await createVoiceApp({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      ...env,
    });
    await resetUserData(ctx.pool);
    return startLearner(ctx.app);
  }

  function expectCleanLogs(text: string) {
    expect(text).toContain('/api/sessions/');
    expect(text).not.toContain(AUDIO_MARKER);
    expect(text).not.toContain(Buffer.from(AUDIO_MARKER).toString('base64'));
    expect(text).not.toContain(Buffer.from(AUDIO_MARKER).toString('hex'));
    for (const transcript of FAKE_TRANSCRIPTS) {
      expect(text).not.toContain(transcript);
    }
  }

  it('[TC-04-13] logs neither the transcript nor the audio bytes for a successful voice answer', async () => {
    logs = captureLogs();
    const learner = await start({});

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      bytes: AUDIO_BYTES,
    });
    const captured = logs.text();
    logs.restore();

    expect(res.status).toBe(201);
    expectCleanLogs(captured);
  });

  it('[TC-04-13] logs neither the transcript nor the audio bytes when speech recognition is unavailable', async () => {
    logs = captureLogs();
    const learner = await start({ FAKE_STT_FAIL: 'unavailable' });

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      bytes: AUDIO_BYTES,
    });
    const captured = logs.text();
    logs.restore();

    expect(res.status).toBe(503);
    expectCleanLogs(captured);
  });
});
