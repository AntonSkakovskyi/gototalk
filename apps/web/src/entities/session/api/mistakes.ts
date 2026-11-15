import {
  MistakeViewSchema,
  type MarkMistakeRequest,
  type MistakeView,
} from '@gototalk/shared';
import { apiFetch } from '@/shared/api/http';
import { sessionApiPath } from './session-details';

export function markMistakeFalse(
  sessionId: string,
  mistakeId: string,
): Promise<MistakeView> {
  const body: MarkMistakeRequest = { isFalse: true };
  return apiFetch(
    `${sessionApiPath(sessionId)}/mistakes/${encodeURIComponent(mistakeId)}`,
    { method: 'PATCH', body, schema: MistakeViewSchema },
  );
}
