import {
  WordPageSchema,
  WordSchema,
  type MarkWordRequest,
  type Word,
  type WordPage,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';
import { pageQueryString } from '@/shared/api/page-query';

interface WordsQuery {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export function listWords({
  cursor,
  limit,
}: WordsQuery = {}): Promise<WordPage> {
  return apiFetch(`/api/words${pageQueryString({ cursor, limit })}`, {
    schema: WordPageSchema,
  });
}

export function markWord(
  id: string,
  state: MarkWordRequest['state'],
): Promise<Word> {
  const body: MarkWordRequest = { state };
  return apiFetch(`/api/words/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    schema: WordSchema,
  });
}
