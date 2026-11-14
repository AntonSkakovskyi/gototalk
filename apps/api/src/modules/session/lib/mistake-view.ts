import { MistakeCategoryCodeSchema } from '@gototalk/shared';
import type { MistakeView } from '@gototalk/shared';
import type { mistakes } from '../../../core/db/schema.js';

export type MistakeRow = typeof mistakes.$inferSelect;

export function toMistakeView(row: MistakeRow): MistakeView | null {
  if (row.startPos === null || row.endPos === null) return null;
  return {
    id: row.id,
    start: row.startPos,
    end: row.endPos,
    original: row.original,
    suggestion: row.suggestion ?? '',
    category: MistakeCategoryCodeSchema.parse(row.category),
    explanationEn: row.explanationEn ?? '',
    translationUk: row.translationUk ?? '',
    isFalse: row.isFalse,
  };
}
