import {
  HintResultSchema,
  SessionSchema,
  TurnResultSchema,
  UtteranceSchema,
  type AnswerTextRequest,
  type HintRequest,
  type HintResult,
  type Session,
  type TurnResult,
  type Utterance,
} from '@gototalk/shared';
import { audioFileName } from '@/features/dialogue/lib/recorder-mime';
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

export function submitAudioAnswer(
  sessionId: string,
  audio: Blob,
): Promise<Utterance> {
  const body = new FormData();
  body.append('audio', audio, audioFileName(audio.type));
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

export function requestHint(
  sessionId: string,
  request: HintRequest,
): Promise<HintResult> {
  return apiFetch(`${sessionPath(sessionId)}/hints`, {
    method: 'POST',
    body: request,
    schema: HintResultSchema,
  });
}

export function finishSession(sessionId: string): Promise<Session> {
  return apiFetch(`${sessionPath(sessionId)}/finish`, {
    method: 'POST',
    schema: SessionSchema,
  });
}
