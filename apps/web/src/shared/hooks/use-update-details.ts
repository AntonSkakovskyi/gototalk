import type { SessionDetails } from '@gototalk/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { sessionKeys } from '@/entities/session/api/session-details';

/** Applies an update to the cached details after cancelling in-flight fetches, so a stale response cannot overwrite it; nothing is created when they are not cached. */
export function useUpdateDetails(sessionId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    async (update: (details: SessionDetails) => SessionDetails) => {
      const queryKey = sessionKeys.details(sessionId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<SessionDetails>(queryKey, (details) =>
        details === undefined ? undefined : update(details),
      );
    },
    [queryClient, sessionId],
  );
}
