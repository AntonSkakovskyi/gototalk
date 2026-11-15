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
import { sessionApiPath } from '@/shared/api/session-details';

export function submitTextAnswer(
  sessionId: string,
  text: string,
): Promise<Utterance> {
  const body: AnswerTextRequest = { text };
  return apiFetch(`${sessionApiPath(sessionId)}/utterances`, {
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
  return apiFetch(`${sessionApiPath(sessionId)}/utterances`, {
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
    `${sessionApiPath(sessionId)}/utterances/${encodeURIComponent(utteranceId)}/analysis`,
    { method: 'POST', schema: TurnResultSchema },
  );
}

export function requestHint(
  sessionId: string,
  request: HintRequest,
): Promise<HintResult> {
  return apiFetch(`${sessionApiPath(sessionId)}/hints`, {
    method: 'POST',
    body: request,
    schema: HintResultSchema,
  });
}

export function finishSession(sessionId: string): Promise<Session> {
  return apiFetch(`${sessionApiPath(sessionId)}/finish`, {
    method: 'POST',
    schema: SessionSchema,
  });
}
