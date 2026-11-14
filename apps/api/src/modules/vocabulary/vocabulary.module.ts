import { Module } from '@nestjs/common';
import { WordsRepository } from './persistence/words.repository.js';
import { SessionWordsRepository } from './persistence/session-words.repository.js';
import { WordUsageService } from './word-usage.service.js';

@Module({
  providers: [WordsRepository, SessionWordsRepository, WordUsageService],
  exports: [WordsRepository, SessionWordsRepository, WordUsageService],
})
export class VocabularyModule {}
