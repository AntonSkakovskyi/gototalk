import { useQuery } from '@tanstack/react-query';
import { sessionDetailsQueryOptions } from '@/features/session/api/session-queries';

export function useSessionDetails(id: string) {
  return useQuery(sessionDetailsQueryOptions(id));
}
