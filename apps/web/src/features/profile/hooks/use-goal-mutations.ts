import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateGoalRequest } from '@gototalk/shared';
import {
  createGoal,
  deleteGoal,
  updateGoal,
} from '@/features/profile/api/profile-api';
import { profileKeys } from '@/features/profile/api/profile-queries';

interface UpdateGoalVariables {
  id: string;
  request: UpdateGoalRequest;
}

function useGoalMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  // Also on failure: a limit or not-found error means the cached list is stale.
  return useMutation({
    mutationFn,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.goals() }),
  });
}

export function useCreateGoal() {
  return useGoalMutation(createGoal);
}

export function useUpdateGoal() {
  return useGoalMutation(({ id, request }: UpdateGoalVariables) =>
    updateGoal(id, request),
  );
}

export function useDeleteGoal() {
  return useGoalMutation(deleteGoal);
}
