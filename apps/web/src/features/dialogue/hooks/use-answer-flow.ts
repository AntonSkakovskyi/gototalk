import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Utterance } from '@gototalk/shared';
import { useCallback, useEffect, useRef } from 'react';
import {
  analyzeAnswer,
  submitAudioAnswer,
  submitTextAnswer,
} from '@/features/dialogue/api/dialogue-api';
import { isTransientError } from '@/features/dialogue/lib/dialogue-errors';
import {
  findUnansweredUtteranceId,
  withTurnResult,
  withUtterance,
} from '@/features/dialogue/lib/details-cache';
import { ApiError } from '@/shared/api/http';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/shared/api/session-details';
import { useUpdateDetails } from './use-update-details';

export type AnswerPhase = 'idle' | 'sending' | 'recognizing' | 'analyzing';

type AnswerInput =
  { kind: 'text'; text: string } | { kind: 'audio'; audio: Blob };

function sendAnswerInput(
  sessionId: string,
  input: AnswerInput,
): Promise<Utterance> {
  return input.kind === 'audio'
    ? submitAudioAnswer(sessionId, input.audio)
    : submitTextAnswer(sessionId, input.text);
}

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

function phaseOf(
  send: { isPending: boolean; variables: AnswerInput | undefined },
  analysis: { isPending: boolean },
): AnswerPhase {
  if (send.isPending) {
    return send.variables?.kind === 'audio' ? 'recognizing' : 'sending';
  }
  return analysis.isPending ? 'analyzing' : 'idle';
}

/** Analyses the last unanswered utterance of the loaded details, e.g. after a reload. */
function useRecovery(sessionId: string, analyzeOnce: (id: string) => void) {
  const { data: details } = useQuery(sessionDetailsQueryOptions(sessionId));
  const unansweredId =
    details === undefined ? undefined : findUnansweredUtteranceId(details);
  useEffect(() => {
    if (unansweredId !== undefined) {
      analyzeOnce(unansweredId);
    }
  }, [unansweredId, analyzeOnce]);
}

type UpdateDetails = ReturnType<typeof useUpdateDetails>;

function useSendAnswer(sessionId: string, updateDetails: UpdateDetails) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: AnswerInput) => sendAnswerInput(sessionId, input),
    // A failed recording must not outlive the screen in the mutation cache.
    gcTime: 0,
    onSuccess: (utterance) =>
      updateDetails((current) => withUtterance(current, utterance)),
    onError: (error, input) => {
      if (hasStatus(error, HTTP_CONFLICT)) {
        void queryClient.invalidateQueries({
          queryKey: sessionKeys.details(sessionId),
        });
        // The server already holds this answer, so a stale error or resend would mislead.
        if (input.kind === 'audio') {
          mutation.reset();
        }
      }
    },
  });
  return mutation;
}

function useAnalysis(sessionId: string, updateDetails: UpdateDetails) {
  // Utterances whose analysis was already started by this mount.
  const started = useRef(new Set<string>());
  const analysis = useMutation({
    mutationFn: (utteranceId: string) => analyzeAnswer(sessionId, utteranceId),
    onSuccess: (result) =>
      updateDetails((current) => withTurnResult(current, result)),
  });
  const { mutate } = analysis;
  const analyzeOnce = useCallback(
    (utteranceId: string) => {
      if (started.current.has(utteranceId)) {
        return;
      }
      started.current.add(utteranceId);
      mutate(utteranceId);
    },
    [mutate],
  );
  return { analysis, analyzeOnce };
}

function useSubmission(
  send: ReturnType<typeof useSendAnswer>,
  analyzeOnce: (id: string) => void,
) {
  async function run(input: AnswerInput): Promise<boolean> {
    try {
      const utterance = await send.mutateAsync(input);
      analyzeOnce(utterance.id);
      // The recording is no longer needed once the server has accepted it.
      send.reset();
      return true;
    } catch {
      // The failure is exposed through submitError.
      return false;
    }
  }

  const audioFailed = send.isError && send.variables?.kind === 'audio';
  const canRetrySend = audioFailed && isTransientError(send.error);

  async function retrySend(): Promise<boolean> {
    const input = send.variables;
    return canRetrySend && input !== undefined ? run(input) : false;
  }

  return {
    submit: (text: string) => run({ kind: 'text', text }),
    submitAudio: (audio: Blob) => run({ kind: 'audio', audio }),
    retrySend,
    canRetrySend,
    audioFailed,
  };
}

export function useAnswerFlow(sessionId: string) {
  const updateDetails = useUpdateDetails(sessionId);
  const send = useSendAnswer(sessionId, updateDetails);
  const { analysis, analyzeOnce } = useAnalysis(sessionId, updateDetails);
  useRecovery(sessionId, analyzeOnce);
  const submission = useSubmission(send, analyzeOnce);

  const canRetryAnalysis =
    analysis.isError && !hasStatus(analysis.error, HTTP_NOT_FOUND);

  function retryAnalysis(): void {
    if (canRetryAnalysis && analysis.variables !== undefined) {
      analysis.mutate(analysis.variables);
    }
  }

  return {
    ...submission,
    phase: phaseOf(send, analysis),
    retryAnalysis,
    canRetryAnalysis,
    submitError: send.error,
    analysisError: analysis.error,
  };
}
