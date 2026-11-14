import {
  MistakeViewSchema,
  type MarkMistakeRequest,
  type MistakeView,
} from '@gototalk/shared';
import { apiFetch } from './http';

export function markMistakeFalse(
  sessionId: string,
  mistakeId: string,
): Promise<MistakeView> {
  const body: MarkMistakeRequest = { isFalse: true };
  return apiFetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/mistakes/${encodeURIComponent(mistakeId)}`,
    { method: 'PATCH', body, schema: MistakeViewSchema },
  );
}
