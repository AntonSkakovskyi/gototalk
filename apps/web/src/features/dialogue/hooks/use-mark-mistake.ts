import { useMutation } from '@tanstack/react-query';
import { markMistakeFalse } from '@/features/dialogue/api/dialogue-api';
import { withMistake } from '@/features/dialogue/lib/details-cache';
import { useUpdateDetails } from './use-update-details';

export function useMarkMistake(sessionId: string) {
  const updateDetails = useUpdateDetails(sessionId);
  const mutation = useMutation({
    mutationFn: (mistakeId: string) => markMistakeFalse(sessionId, mistakeId),
    onSuccess: (mistake) =>
      updateDetails((details) => withMistake(details, mistake)),
  });

  return {
    mark: (mistakeId: string) => mutation.mutate(mistakeId),
    isPendingFor: (mistakeId: string) =>
      mutation.isPending && mutation.variables === mistakeId,
    error: mutation.error,
  };
}
