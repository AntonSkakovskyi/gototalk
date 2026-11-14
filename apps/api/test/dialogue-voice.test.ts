import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { MAX_AUDIO_BYTES, UtteranceSchema } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PG_POOL } from '../src/core/db/db.tokens.js';
import { cleanTranscript } from '../src/integrations/speech-recognition/clean-transcript.js';
import { FAKE_TRANSCRIPTS } from '../src/integrations/speech-recognition/fake-transcripts.js';
import { SPEECH_RECOGNITION_PORT } from '../src/integrations/speech-recognition/speech-recognition.port.js';
import type { SpeechRecognitionPort } from '../src/integrations/speech-recognition/speech-recognition.port.js';
import {
  expectError,
  grantConsent,
  registerUser,
} from './support/api-client.js';
import { postAudio, webmAudio } from './support/audio.js';
import {
  analyse,
  fetchDetails,
  mistakeRows,
  patternRows,
  postAnswer,
  startLearner,
  utteranceRows,
} from './support/dialogue-flow.js';
import { createTestApp } from './support/test-app.js';
import { resetUserData } from './support/test-db.js';

async function createVoiceApp(env: Record<string, string> = {}) {
  const app = await createTestApp({ env });
  const speech = app.get<SpeechRecognitionPort>(SPEECH_RECOGNITION_PORT);
  const transcribe = vi.fn(speech.transcribe.bind(speech));
  speech.transcribe = transcribe;
  const close = async () => {
    await app.close();
    // ConfigModule copies the validated env into process.env, which would leak into the next app
    for (const key of Object.keys(env)) delete process.env[key];
  };
  return { app, pool: app.get<pg.Pool>(PG_POOL), transcribe, close };
}

type VoiceApp = Awaited<ReturnType<typeof createVoiceApp>>;

const TEXT_ANSWER = 'I very like weekends';

function multipartRequest(app: INestApplication, token: string, id: string) {
  return request(app.getHttpServer())
    .post(`/api/sessions/${id}/utterances`)
    .set('Authorization', `Bearer ${token}`);
}

describe('POST /api/sessions/:id/utterances with audio', () => {
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

  it('[TC-04-02] stores the transcript as a pending utterance, then step 2 saves mistakes and patterns', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id);

    expect(res.status).toBe(201);
    expect(UtteranceSchema.parse(res.body)).toMatchObject({
      seq: 2,
      role: 'user',
      text: FAKE_TRANSCRIPTS[0],
      analysisStatus: 'pending',
      mistakes: [],
      better: [],
    });
    const rows = await utteranceRows(ctx.pool, learner.session.id);
    expect(rows[1]).toMatchObject({
      role: 'user',
      text_verbatim: FAKE_TRANSCRIPTS[0],
      analysis_status: 'pending',
    });
    const { rows: clean } = await ctx.pool.query<{ text_clean: string }>(
      'SELECT text_clean FROM utterances WHERE id = $1',
      [res.body.id],
    );
    expect(clean[0]?.text_clean).toBe(
      cleanTranscript(FAKE_TRANSCRIPTS[0] ?? ''),
    );

    const result = await analyse(ctx.app, learner, res.body.id);

    expect(result.utterance.analysisStatus).toBe('done');
    expect(result.utterance.mistakes.map((m) => m.category)).toEqual([
      'verb_tense',
      'word_order',
    ]);
    expect(result.reply).not.toBeNull();
    expect(
      (await mistakeRows(ctx.pool, res.body.id)).map((m) => m.category),
    ).toEqual(['verb_tense', 'word_order']);
    expect(
      (await patternRows(ctx.pool, learner.id)).map((p) => [
        p.category,
        p.frequency,
      ]),
    ).toEqual([
      ['verb_tense', 1],
      ['word_order', 1],
    ]);
  });

  it('[TC-04-02] picks the transcript by the number of user utterances in the session', async () => {
    const learner = await startLearner(ctx.app);
    const first = await postAudio(ctx.app, learner.token, learner.session.id);
    await analyse(ctx.app, learner, first.body.id);

    const second = await postAudio(ctx.app, learner.token, learner.session.id);

    expect(second.status).toBe(201);
    expect(second.body.text).toBe(FAKE_TRANSCRIPTS[1]);
    expect(ctx.transcribe.mock.calls.map((call) => call[2])).toEqual([0, 1]);
  });

  it('[TC-04-02] passes the base MIME type to the provider', async () => {
    const learner = await startLearner(ctx.app);

    await postAudio(ctx.app, learner.token, learner.session.id, {
      mime: 'audio/webm;codecs=opus',
    });

    expect(ctx.transcribe.mock.calls[0]?.[1]).toBe('audio/webm');
  });

  it('[TC-04-02] accepts a file of exactly MAX_AUDIO_BYTES', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id, {
      bytes: webmAudio(MAX_AUDIO_BYTES),
    });

    expect(res.status).toBe(201);
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

  it('[TC-04-02] still accepts a JSON text answer without speech recognition', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAnswer(
      ctx.app,
      learner.token,
      learner.session.id,
      TEXT_ANSWER,
    );

    expect(res.status).toBe(201);
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] returns 401 without a token', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/sessions/${randomUUID()}/utterances`)
      .attach('audio', webmAudio(), {
        filename: 'answer.webm',
        contentType: 'audio/webm',
      });

    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('[TC-04-02] returns 403 CONSENT_REQUIRED before consent without calling the provider', async () => {
    const learner = await startLearner(ctx.app);
    const other = await registerUser(ctx.app);

    expectError(
      await postAudio(ctx.app, other.token, learner.session.id),
      403,
      'CONSENT_REQUIRED',
    );
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] gives the same 404 for a foreign, unknown and malformed session id without calling the provider', async () => {
    const learner = await startLearner(ctx.app);
    const intruder = await registerUser(ctx.app);
    await grantConsent(ctx.app, intruder.token);

    const bodies: unknown[] = [];
    for (const id of [learner.session.id, randomUUID(), 'not-a-uuid']) {
      const res = await postAudio(ctx.app, intruder.token, id);
      expectError(res, 404, 'SESSION_NOT_FOUND');
      bodies.push(res.body);
    }

    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] returns 409 SESSION_FINISHED for a finished session without calling the provider', async () => {
    const learner = await startLearner(ctx.app);
    await ctx.pool.query(
      `UPDATE sessions SET status = 'finished', ended_at = now() WHERE id = $1`,
      [learner.session.id],
    );

    expectError(
      await postAudio(ctx.app, learner.token, learner.session.id),
      409,
      'SESSION_FINISHED',
    );
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(1);
  });

  it('[TC-04-02] returns 409 ANSWER_NOT_EXPECTED for a second answer without calling the provider again', async () => {
    const learner = await startLearner(ctx.app);
    expect(
      (await postAudio(ctx.app, learner.token, learner.session.id)).status,
    ).toBe(201);
    ctx.transcribe.mockClear();

    expectError(
      await postAudio(ctx.app, learner.token, learner.session.id),
      409,
      'ANSWER_NOT_EXPECTED',
    );
    expect(ctx.transcribe).not.toHaveBeenCalled();
    expect(await utteranceRows(ctx.pool, learner.session.id)).toHaveLength(2);
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

  it('[TC-04-08] answers 503 SPEECH_RECOGNITION_UNAVAILABLE, leaves the session unchanged and still takes a text answer', async () => {
    const learner = await startLearner(ctx.app);

    const res = await postAudio(ctx.app, learner.token, learner.session.id);

    expectError(res, 503, 'SPEECH_RECOGNITION_UNAVAILABLE');
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
