import { WordSchema, type MarkWordRequest, type Word } from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';

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
