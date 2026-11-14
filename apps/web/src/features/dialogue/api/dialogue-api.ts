import {
  MistakeViewSchema,
  SessionSchema,
  TurnResultSchema,
  UtteranceSchema,
  type AnswerTextRequest,
  type MarkMistakeRequest,
  type MistakeView,
  type Session,
  type TurnResult,
  type Utterance,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';

function sessionPath(sessionId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}`;
}

export function submitTextAnswer(
  sessionId: string,
  text: string,
): Promise<Utterance> {
  const body: AnswerTextRequest = { text };
  return apiFetch(`${sessionPath(sessionId)}/utterances`, {
    method: 'POST',
    body,
    schema: UtteranceSchema,
  });
}

export function analyzeAnswer(
  sessionId: string,
  utteranceId: string,
): Promise<TurnResult> {
  return apiFetch(
    `${sessionPath(sessionId)}/utterances/${encodeURIComponent(utteranceId)}/analysis`,
    { method: 'POST', schema: TurnResultSchema },
  );
}

export function markMistakeFalse(
  sessionId: string,
  mistakeId: string,
): Promise<MistakeView> {
  const body: MarkMistakeRequest = { isFalse: true };
  return apiFetch(
    `${sessionPath(sessionId)}/mistakes/${encodeURIComponent(mistakeId)}`,
    { method: 'PATCH', body, schema: MistakeViewSchema },
  );
}

export function finishSession(sessionId: string): Promise<Session> {
  return apiFetch(`${sessionPath(sessionId)}/finish`, {
    method: 'POST',
    schema: SessionSchema,
  });
}
