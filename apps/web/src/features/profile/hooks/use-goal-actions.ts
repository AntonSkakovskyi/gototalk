import type { GoalStatus } from '@gototalk/shared';
import { useState } from 'react';
import {
  useCreateGoal,
  useDeleteGoal,
  useUpdateGoal,
} from '@/features/profile/hooks/use-goal-mutations';
import {
  profileErrorKey,
  type ProfileErrorMessage,
} from '@/features/profile/lib/profile-errors';

export interface GoalActions {
  error: ProfileErrorMessage | null;
  isPending: boolean;
  add: (title: string, onSuccess: () => void) => void;
  rename: (id: string, title: string, onSuccess: () => void) => void;
  setStatus: (id: string, status: GoalStatus) => void;
  remove: (id: string) => void;
}

const noop = () => undefined;

export function useGoalActions(onRemoved: () => void): GoalActions {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const [error, setError] = useState<ProfileErrorMessage | null>(null);

  const begin = (onSuccess: () => void = noop) => {
    setError(null);
    return {
      onSuccess,
      onError: (failure: unknown) => setError(profileErrorKey(failure)),
    };
  };

  return {
    error,
    isPending: create.isPending || update.isPending || remove.isPending,
    add: (title, onSuccess) => create.mutate({ title }, begin(onSuccess)),
    rename: (id, title, onSuccess) =>
      update.mutate({ id, request: { title } }, begin(onSuccess)),
    setStatus: (id, status) =>
      update.mutate({ id, request: { status } }, begin()),
    remove: (id) => remove.mutate(id, begin(onRemoved)),
  };
}
