import {
  GoalListSchema,
  GoalSchema,
  LearnerModelSchema,
  ProfileSchema,
  type CreateGoalRequest,
  type Goal,
  type LearnerModel,
  type Profile,
  type UpdateGoalRequest,
  type UpdateProfileRequest,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';

export function getProfile(): Promise<Profile> {
  return apiFetch('/api/profile', { schema: ProfileSchema });
}

export function updateProfile(request: UpdateProfileRequest): Promise<Profile> {
  return apiFetch('/api/profile', {
    method: 'PUT',
    body: request,
    schema: ProfileSchema,
  });
}

export function listGoals(): Promise<Goal[]> {
  return apiFetch('/api/goals', { schema: GoalListSchema });
}

export function createGoal(request: CreateGoalRequest): Promise<Goal> {
  return apiFetch('/api/goals', {
    method: 'POST',
    body: request,
    schema: GoalSchema,
  });
}

export function updateGoal(
  id: string,
  request: UpdateGoalRequest,
): Promise<Goal> {
  return apiFetch(`/api/goals/${id}`, {
    method: 'PATCH',
    body: request,
    schema: GoalSchema,
  });
}

export function deleteGoal(id: string): Promise<void> {
  return apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
}

export function getLearnerModel(): Promise<LearnerModel> {
  return apiFetch('/api/profile/learner-model', {
    schema: LearnerModelSchema,
  });
}
