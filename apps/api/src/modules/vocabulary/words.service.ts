import { Injectable } from '@nestjs/common';
import { WordSchema } from '@gototalk/shared';
import type { MarkWordRequest, Word } from '@gototalk/shared';
import { WordMarkingRepository } from './persistence/word-marking.repository.js';
import { WordAlreadyActiveError, WordNotFoundError } from './words.errors.js';

@Injectable()
export class WordsService {
  constructor(private readonly marking: WordMarkingRepository) {}

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
