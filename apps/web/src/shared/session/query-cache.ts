import type { QueryClient } from '@tanstack/react-query';
import { onSessionCleared } from './session-store';

export function clearQueryCacheOnSessionEnd(
  queryClient: QueryClient,
): () => void {
  return onSessionCleared(() => queryClient.clear());
}
