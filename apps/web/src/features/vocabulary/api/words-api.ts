import {
  WordPageSchema,
  WordSchema,
  type MarkWordRequest,
  type Word,
  type WordPage,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';

interface WordsQuery {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export function listWords({
  cursor,
  limit,
}: WordsQuery = {}): Promise<WordPage> {
  const params = new URLSearchParams();
  if (cursor !== undefined) {
    params.set('cursor', cursor);
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  return apiFetch(`/api/words${query === '' ? '' : `?${query}`}`, {
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
