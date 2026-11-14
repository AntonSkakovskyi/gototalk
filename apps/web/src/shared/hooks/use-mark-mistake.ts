import { useMutation, useQueryClient } from '@tanstack/react-query';
import { withMistake } from '@/shared/api/details-cache';
import { markMistakeFalse } from '@/shared/api/mistakes';
import { sessionKeys } from '@/shared/api/session-details';
import { useUpdateDetails } from './use-update-details';

export function useMarkMistake(sessionId: string) {
  const queryClient = useQueryClient();
  const updateDetails = useUpdateDetails(sessionId);
  const mutation = useMutation({
    mutationFn: (mistakeId: string) => markMistakeFalse(sessionId, mistakeId),
    onSuccess: async (mistake) => {
      await updateDetails((details) => withMistake(details, mistake));
      await queryClient.invalidateQueries({
        queryKey: sessionKeys.report(sessionId),
      });
    },
  });

  return {
    mark: (mistakeId: string) => mutation.mutate(mistakeId),
    isPendingFor: (mistakeId: string) =>
      mutation.isPending && mutation.variables === mistakeId,
    error: mutation.error,
  };
}
