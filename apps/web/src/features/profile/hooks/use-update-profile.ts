import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/features/profile/api/profile-api';
import { profileKeys } from '@/features/profile/api/profile-queries';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) =>
      queryClient.setQueryData(profileKeys.profile(), profile),
  });
}
