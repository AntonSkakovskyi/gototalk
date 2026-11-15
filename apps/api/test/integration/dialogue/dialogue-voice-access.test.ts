import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  expectError,
  grantConsent,
  registerUser,
} from '../../support/api-client.js';
import { postAudio, webmAudio } from '../../support/audio.js';
import { startLearner, utteranceRows } from '../../support/dialogue-flow.js';
import { createVoiceApp } from '../../support/voice-app.js';
import type { VoiceApp } from '../../support/voice-app.js';
import { resetUserData } from '../../support/test-db.js';

describe('voice answer access and session state', () => {
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

  it('[TC-04-02] answers 404 for a foreign session even when the MIME type is not supported', async () => {
    const learner = await startLearner(ctx.app);
    const intruder = await registerUser(ctx.app);
    await grantConsent(ctx.app, intruder.token);

    const res = await postAudio(ctx.app, intruder.token, learner.session.id, {
      mime: 'audio/wav',
    });

    expectError(res, 404, 'SESSION_NOT_FOUND');
    expect(ctx.transcribe).not.toHaveBeenCalled();
  });

  it('[TC-04-02] lets exactly one of two parallel voice answers through', async () => {
    const learner = await startLearner(ctx.app);

    const responses = await Promise.all([
      postAudio(ctx.app, learner.token, learner.session.id),
      postAudio(ctx.app, learner.token, learner.session.id),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    const conflict = responses.find((res) => res.status === 409);
    if (!conflict) throw new Error('Expected one conflict');
    expectError(conflict, 409, 'ANSWER_NOT_EXPECTED');
    const rows = await utteranceRows(ctx.pool, learner.session.id);
    expect(rows.filter((row) => row.role === 'user')).toHaveLength(1);
  });
});
