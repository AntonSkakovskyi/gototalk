import type { HintRequest } from '@gototalk/shared';
import { useMutation } from '@tanstack/react-query';
import { requestHint } from '@/features/dialogue/api/dialogue-api';

export function useHint(sessionId: string) {
  const mutation = useMutation({
    mutationFn: (request: HintRequest) => requestHint(sessionId, request),
  });
  const { variables, mutate } = mutation;

  return {
    phraseStart: () => mutate({ kind: 'phrase_start' }),
    translate: (word: string) => mutate({ kind: 'translation', word }),
    retry: () => {
      if (variables !== undefined) {
        mutate(variables);
      }
    },
    /** The request that produced `data` or `error`. */
    request: variables,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
