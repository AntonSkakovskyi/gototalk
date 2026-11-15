import { MAX_AUDIO_BYTES, UtteranceSchema } from '@gototalk/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanTranscript } from '../../../src/integrations/speech-recognition/clean-transcript.js';
import { FAKE_TRANSCRIPTS } from '../../../src/integrations/speech-recognition/fake/fake-transcripts.js';
import { postAudio, webmAudio } from '../../support/audio.js';
import {
  analyse,
  mistakeRows,
  patternRows,
  postAnswer,
  startLearner,
  utteranceRows,
} from '../../support/dialogue-flow.js';
import { createVoiceApp } from '../../support/voice-app.js';
import type { VoiceApp } from '../../support/voice-app.js';
import { resetUserData } from '../../support/test-db.js';

const TEXT_ANSWER = 'I very like weekends';

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
});
