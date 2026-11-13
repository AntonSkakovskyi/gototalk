import { queryOptions } from '@tanstack/react-query';
import { retryUnlessClientError } from '@/shared/api/retry-policy';
import { getLearnerModel, getProfile, listGoals } from './profile-api';

export const profileKeys = {
  all: ['profile'] as const,
  profile: () => [...profileKeys.all, 'profile'] as const,
  goals: () => [...profileKeys.all, 'goals'] as const,
  learnerModel: () => [...profileKeys.all, 'learner-model'] as const,
};

const MAX_PROFILE_RETRIES = 1;

export function profileQueryOptions() {
  return queryOptions({
    queryKey: profileKeys.profile(),
    queryFn: getProfile,
    retry: retryUnlessClientError(MAX_PROFILE_RETRIES),
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
