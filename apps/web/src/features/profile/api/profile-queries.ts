import { queryOptions } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/http';
import { getLearnerModel, getProfile, listGoals } from './profile-api';

export const profileKeys = {
  all: ['profile'] as const,
  profile: () => [...profileKeys.all, 'profile'] as const,
  goals: () => [...profileKeys.all, 'goals'] as const,
  learnerModel: () => [...profileKeys.all, 'learner-model'] as const,
};

const MAX_PROFILE_RETRIES = 1;

function retryUnlessClientError(failureCount: number, error: Error): boolean {
  const isClientError =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_PROFILE_RETRIES;
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: profileKeys.profile(),
    queryFn: getProfile,
    retry: retryUnlessClientError,
  });
}

export function goalsQueryOptions() {
  return queryOptions({ queryKey: profileKeys.goals(), queryFn: listGoals });
}

export function learnerModelQueryOptions() {
  return queryOptions({
    queryKey: profileKeys.learnerModel(),
    queryFn: getLearnerModel,
  });
}
