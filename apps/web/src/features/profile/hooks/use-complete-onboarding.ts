import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { UpdateProfileRequest } from '@gototalk/shared';
import { createGoal, updateProfile } from '@/features/profile/api/profile-api';
import {
  goalsQueryOptions,
  profileKeys,
} from '@/features/profile/api/profile-queries';

type OnboardingInput = UpdateProfileRequest & { goals: string[] };

function goalKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function createMissingGoals(
  queryClient: QueryClient,
  titles: string[],
): Promise<void> {
  const goals = await queryClient.query({
    ...goalsQueryOptions(),
    staleTime: 0,
  });
  const known = new Set(
    goals
      .filter(({ status }) => status === 'active')
      .map(({ title }) => goalKey(title)),
  );
  for (const title of titles) {
    if (!known.has(goalKey(title))) {
      known.add(goalKey(title));
      await createGoal({ title: title.trim() });
    }
  }
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    // The profile is saved last: it marks onboarding as complete, so a retry must be safe.
    mutationFn: async ({ level, scenes, goals }: OnboardingInput) => {
      await createMissingGoals(queryClient, goals);
      return updateProfile({ level, scenes });
    },
    onSuccess: (profile) => {
      // The cached profile may hold the guard's 404; seed it so the redirect does not bounce back.
      queryClient.setQueryData(profileKeys.profile(), profile);
      return queryClient.invalidateQueries({ queryKey: profileKeys.goals() });
    },
  });
}
