import type { INestApplication } from '@nestjs/common';
import { SessionDetailsSchema } from '@gototalk/shared';
import type { SessionDetails } from '@gototalk/shared';
import type pg from 'pg';
import request from 'supertest';
import { expect } from 'vitest';
import { grantConsent, registerUser } from './api-client.js';

const PLAN = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: [
    'What are you doing this weekend?',
    'Who do you usually spend it with?',
    'Where do you like to go?',
    'What did you do last weekend?',
    'What would be your perfect weekend?',
  ],
};

interface UtteranceRow {
  seq: number;
  role: string;
  text_verbatim: string;
  text_clean: string | null;
  analysis_status: string;
}

export function createAnswerClient(
  getApp: () => INestApplication,
  getPool: () => pg.Pool,
) {
  const answer = (token: string, sessionId: string, body: object) =>
    request(getApp().getHttpServer())
      .post(`/api/sessions/${sessionId}/utterances`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  async function startedSession(): Promise<{
    id: string;
    token: string;
    session: SessionDetails;
  }> {
    const user = await registerUser(getApp());
    await grantConsent(getApp(), user.token);
    const res = await request(getApp().getHttpServer())
      .post('/api/sessions')
      .set('Authorization', `Bearer ${user.token}`)
      .send(PLAN);
    expect(res.status).toBe(201);
    const session = SessionDetailsSchema.parse(res.body);
    return { id: user.id, token: user.token, session };
  }

  async function utteranceRows(sessionId: string): Promise<UtteranceRow[]> {
    const { rows } = await getPool().query<UtteranceRow>(
      `SELECT seq, role, text_verbatim, text_clean, analysis_status
         FROM utterances WHERE session_id = $1 ORDER BY seq`,
      [sessionId],
    );
    return rows;
  }

  return { answer, startedSession, utteranceRows };
}
