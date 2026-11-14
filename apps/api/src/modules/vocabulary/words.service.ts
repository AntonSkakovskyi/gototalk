import { Injectable } from '@nestjs/common';
import { WordSchema } from '@gototalk/shared';
import type {
  MarkWordRequest,
  PageQuery,
  Word,
  WordPage,
} from '@gototalk/shared';
import { afterOf, toCursorPage } from '../../common/keyset-page.js';
import { WordMarkingRepository } from './persistence/word-marking.repository.js';
import { WordsPageRepository } from './persistence/words-page.repository.js';
import { WordAlreadyActiveError, WordNotFoundError } from './words.errors.js';

@Injectable()
export class WordsService {
  constructor(
    private readonly marking: WordMarkingRepository,
    private readonly pages: WordsPageRepository,
  ) {}

  async list(userId: string, query: PageQuery): Promise<WordPage> {
    const page = await this.pages.listPage(userId, {
      after: afterOf(query.cursor),
      limit: query.limit,
    });
    return toCursorPage(page);
  }

  async mark(
    userId: string,
    id: string,
    state: MarkWordRequest['state'],
  ): Promise<Word> {
    if (!WordSchema.shape.id.safeParse(id).success) {
      throw new WordNotFoundError();
    }
    const result = await this.marking.markState(userId, id, state);
    if (result === 'not_found') throw new WordNotFoundError();
    if (result === 'active') throw new WordAlreadyActiveError();
    return result;
  }
}
