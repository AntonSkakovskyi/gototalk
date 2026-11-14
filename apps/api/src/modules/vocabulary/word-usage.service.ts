import { Injectable } from '@nestjs/common';
import type { DbExecutor } from '../../core/db/db.tokens.js';
import { usageCandidates } from './lib/word-usage.js';
import { WordsRepository } from './persistence/words.repository.js';

@Injectable()
export class WordUsageService {
  constructor(private readonly words: WordsRepository) {}

  recordUsage(
    executor: DbExecutor,
    userId: string,
    textClean: string,
  ): Promise<number> {
    return this.words.recordUsage(executor, userId, usageCandidates(textClean));
  }
}
