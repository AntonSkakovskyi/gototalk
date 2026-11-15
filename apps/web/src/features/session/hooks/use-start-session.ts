import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startSession } from '@/features/session/api/session-api';
import { sessionKeys } from '@/entities/session/api/session-details';

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startSession,
    onSuccess: (details) =>
      queryClient.setQueryData(sessionKeys.details(details.id), details),
    // Also on failure: a previous active session may have been finished server-side.
    onSettled: async (details) => {
      await Promise.all([
        queryClient.resetQueries({ queryKey: sessionKeys.list() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.history() }),
        queryClient.invalidateQueries({
          queryKey: sessionKeys.allDetails(),
          predicate: (query) => query.queryKey[2] !== details?.id,
        }),
      ]);
    },
  });
}
