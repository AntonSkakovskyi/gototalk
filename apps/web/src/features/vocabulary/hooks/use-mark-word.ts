import type {
  MarkWordRequest,
  SessionReport,
  Word,
  WordPage,
} from '@gototalk/shared';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { sessionKeys } from '@/shared/api/session-details';
import { markWord } from '@/features/vocabulary/api/words-api';
import { wordKeys } from '@/features/vocabulary/api/words-queries';
import {
  withWordInPages,
  withWordInReport,
} from '@/features/vocabulary/lib/words-cache';

interface MarkVariables {
  word: Word;
  state: MarkWordRequest['state'];
}

export function useMarkWord() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ word, state }: MarkVariables) => markWord(word.id, state),
    onSuccess: async (updated) => {
      const reportsKey = sessionKeys.allReports();
      // Cancelling first keeps an in-flight refetch from overwriting the new state.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reportsKey }),
        queryClient.cancelQueries({ queryKey: wordKeys.all }),
      ]);
      queryClient.setQueriesData<SessionReport>(
        { queryKey: reportsKey },
        (report) => report && withWordInReport(report, updated),
      );
      queryClient.setQueriesData<InfiniteData<WordPage>>(
        { queryKey: wordKeys.all },
        (data) => data && withWordInPages(data, updated),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reportsKey }),
        queryClient.invalidateQueries({ queryKey: wordKeys.all }),
      ]);
    },
  });

  return {
    mark: (word: Word, state: MarkVariables['state']) => {
      if (word.state !== state) {
        mutation.mutate({ word, state });
      }
    },
    isPendingFor: (wordId: string) =>
      mutation.isPending && mutation.variables.word.id === wordId,
    errorFor: (wordId: string) =>
      mutation.isError && mutation.variables.word.id === wordId
        ? mutation.error
        : null,
  };
}
