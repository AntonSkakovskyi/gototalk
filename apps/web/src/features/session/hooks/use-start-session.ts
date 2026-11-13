import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startSession } from '@/features/session/api/session-api';
import { sessionKeys } from '@/features/session/api/session-queries';

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startSession,
    onSuccess: (details) =>
      queryClient.setQueryData(sessionKeys.details(details.id), details),
    // Also on failure: a previous active session may have been finished server-side.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() }),
  });
}
