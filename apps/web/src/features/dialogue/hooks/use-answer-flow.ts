import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  analyzeAnswer,
  submitTextAnswer,
} from '@/features/dialogue/api/dialogue-api';
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

export type AnswerPhase = 'idle' | 'sending' | 'analyzing';

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

function phaseOf(
  send: { isPending: boolean },
  analysis: { isPending: boolean },
): AnswerPhase {
  if (send.isPending) {
    return 'sending';
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
  return useMutation({
    mutationFn: (text: string) => submitTextAnswer(sessionId, text),
    onSuccess: (utterance) =>
      updateDetails((current) => withUtterance(current, utterance)),
    onError: (error) => {
      if (hasStatus(error, HTTP_CONFLICT)) {
        void queryClient.invalidateQueries({
          queryKey: sessionKeys.details(sessionId),
        });
      }
    },
  });
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

export function useAnswerFlow(sessionId: string) {
  const updateDetails = useUpdateDetails(sessionId);
  const send = useSendAnswer(sessionId, updateDetails);
  const { analysis, analyzeOnce } = useAnalysis(sessionId, updateDetails);
  useRecovery(sessionId, analyzeOnce);

  async function submit(text: string): Promise<boolean> {
    try {
      const utterance = await send.mutateAsync(text);
      analyzeOnce(utterance.id);
      return true;
    } catch {
      // The failure is exposed through submitError.
      return false;
    }
  }

  const canRetryAnalysis =
    analysis.isError && !hasStatus(analysis.error, HTTP_NOT_FOUND);

  function retryAnalysis(): void {
    if (canRetryAnalysis && analysis.variables !== undefined) {
      analysis.mutate(analysis.variables);
    }
  }

  return {
    phase: phaseOf(send, analysis),
    submit,
    retryAnalysis,
    canRetryAnalysis,
    submitError: send.error,
    analysisError: analysis.error,
    analyzingUtteranceId:
      analysis.isPending || analysis.isError
        ? (analysis.variables ?? null)
        : null,
  };
}
