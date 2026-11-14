import { MAX_AUDIO_BYTES } from '@gototalk/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectError } from './support/api-client.js';
import { postAudio, webmAudio } from './support/audio.js';
import {
  analyse,
  fetchDetails,
  patternRows,
  postAnswer,
  seedWords,
  startLearner,
  utteranceRows,
  wordRows,
} from './support/dialogue-flow.js';
import { createVoiceApp, multipartRequest } from './support/voice-app.js';
import type { VoiceApp } from './support/voice-app.js';
import { resetUserData } from './support/test-db.js';

const TEXT_ANSWER = 'I very like weekends';

describe('voice answer upload errors', () => {
  let ctx: VoiceApp;

  beforeAll(async () => {
    ctx = await createVoiceApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetUserData(ctx.pool);
    ctx.transcribe.mockClear();
  });

  it('[TC-04-13] rejects a file over MAX_AUDIO_BYTES with 413 AUDIO_TOO_LARGE and stores nothing', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      bytes: webmAudio(MAX_AUDIO_BYTES + 1),
    });

    expectError(res, 413, 'AUDIO_TOO_LARGE');
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
  });

  it('[TC-04-13] rejects a MIME type outside the whitelist with 415 AUDIO_UNSUPPORTED', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      mime: 'audio/wav',
    });

    expectError(res, 415, 'AUDIO_UNSUPPORTED');
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
  });

  it('[TC-04-13] rejects a whitelisted MIME type with a wrong signature with 415 AUDIO_UNSUPPORTED', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      bytes: Buffer.from('this is not audio at all'),
      mime: 'audio/webm',
    });

    expectError(res, 415, 'AUDIO_UNSUPPORTED');
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] rejects a file together with a text field with 400 VALIDATION_ERROR', async () => {
    const learner = await startLearner(ctx.app);

    const res = await multipartRequest(
      ctx.app,
      learner.token,
      learner.session.id,
    )
      .field('text', 'Hello')
      .attach('audio', webmAudio(), {
        filename: 'answer.webm',
        contentType: 'audio/webm',
      });

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
  });

  it('[TC-04-02] rejects a file in a field other than audio with 400 VALIDATION_ERROR', async () => {
    const learner = await startLearner(ctx.app);

    const res = await multipartRequest(
      ctx.app,
      learner.token,
      learner.session.id,
    ).attach('file', webmAudio(), {
      filename: 'answer.webm',
      contentType: 'audio/webm',
    });

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] rejects a request with neither a file nor a text with 400 VALIDATION_ERROR', async () => {
    const learner = await startLearner(ctx.app);

    const json = await multipartRequest(
      ctx.app,
      learner.token,
      learner.session.id,
    ).send({});
    const multipart = await multipartRequest(
      ctx.app,
      learner.token,
      learner.session.id,
    )
      .set('Content-Type', 'multipart/form-data; boundary=x')
      .send('--x--\r\n');

    expectError(json, 400, 'VALIDATION_ERROR');
    expectError(multipart, 400, 'VALIDATION_ERROR');
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-13] rejects a malformed multipart body with 400 VALIDATION_ERROR', async () => {
    const learner = await startLearner(ctx.app);

    const res = await multipartRequest(
      ctx.app,
      learner.token,
      learner.session.id,
    )
      .set('Content-Type', 'multipart/form-data; boundary=x')
      .send(
        '--x\r\nContent-Disposition: form-data; name="audio"; filename="a.webm"\r\nContent-Type: audio/webm\r\n\r\nunterminated',
      );

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
  });
});

describe('voice answer with FAKE_STT_FAIL=unavailable', () => {
  let ctx: VoiceApp;

  beforeAll(async () => {
    ctx = await createVoiceApp({ FAKE_STT_FAIL: 'unavailable' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetUserData(ctx.pool);
  });

  it('[TC-04-08] answers 503 SPEECH_RECOGNITION_UNAVAILABLE, leaves the session and word usage unchanged and still takes a text answer', async () => {
    const learner = await startLearner(ctx.app);
    await seedWords(ctx.pool, learner.id, [
      ['deadline', 'passive'],
      ['weekend', 'new'],
    ]);
    const wordsBefore = await wordRows(ctx.pool, learner.id);

    const res = await postAudio(ctx.app, learner.token, learner.session.id);

    expectError(res, 503, 'SPEECH_RECOGNITION_UNAVAILABLE');
    expect(await wordRows(ctx.pool, learner.id)).toEqual(wordsBefore);
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
    const details = await fetchDetails(ctx.app, learner);
    expect(details.status).toBe('active');
    expect(details.utterances).toHaveLength(1);

    const retry = await postAnswer(
      ctx.app,
      learner.token,
      learner.session.id,
      TEXT_ANSWER,
    );
    expect(retry.status).toBe(201);
  });
});

describe('voice answer with FAKE_LLM_FAIL=invalid_json', () => {
  let ctx: VoiceApp;

  beforeAll(async () => {
    ctx = await createVoiceApp({ FAKE_LLM_FAIL: 'invalid_json' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetUserData(ctx.pool);
  });

  it('[TC-04-08] marks the analysis failed and still returns the next question', async () => {
    const learner = await startLearner(ctx.app);
    const answer = await postAudio(ctx.app, learner.token, learner.session.id);
    expect(answer.status).toBe(201);

    const result = await analyse(ctx.app, learner, answer.body.id);

    expect(result.utterance.analysisStatus).toBe('failed');
    expect(result.utterance.mistakes).toEqual([]);
    expect(result.reply).not.toBeNull();
    expect(await patternRows(ctx.pool, learner.id)).toEqual([]);
  });
});
