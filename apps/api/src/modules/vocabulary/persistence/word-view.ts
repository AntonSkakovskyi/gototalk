import {
  WordSchema,
  WordSourceSchema,
  WordStateSchema,
} from '@gototalk/shared';
import type { Word } from '@gototalk/shared';
import { words } from '../../../core/db/schema.js';

export const WORD_COLUMNS = {
  id: words.id,
  lemma: words.lemma,
  translationUk: words.translationUk,
  state: words.state,
  source: words.source,
  createdAt: words.createdAt,
};

export type WordViewRow = {
  id: string;
  lemma: string;
  translationUk: string | null;
  state: string;
  source: string;
};

export function toWord(row: WordViewRow): Word {
  return WordSchema.parse({
    id: row.id,
    lemma: row.lemma,
    translationUk: row.translationUk,
    state: WordStateSchema.parse(row.state),
    source: WordSourceSchema.parse(row.source),
  });
}
