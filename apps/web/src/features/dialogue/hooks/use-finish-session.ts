import { useMutation, useQueryClient } from '@tanstack/react-query';
import { finishSession } from '@/features/dialogue/api/dialogue-api';
import { withSession } from '@/features/dialogue/lib/details-cache';
import { sessionKeys } from '@/shared/api/session-details';
import { useUpdateDetails } from './use-update-details';

export function useFinishSession(sessionId: string) {
  const queryClient = useQueryClient();
  const updateDetails = useUpdateDetails(sessionId);
  const mutation = useMutation({
    mutationFn: () => finishSession(sessionId),
    onSuccess: async (session) => {
      await updateDetails((details) => withSession(details, session));
      void queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
  });

  return {
    /** The per-call onSuccess runs only while the calling component stays mounted, so it must navigate from the same screen. */
    finish: (onFinished: () => void) =>
      mutation.mutate(undefined, { onSuccess: () => onFinished() }),
    isFinishing: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
