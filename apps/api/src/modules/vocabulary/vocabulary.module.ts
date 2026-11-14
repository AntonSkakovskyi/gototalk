import { Module } from '@nestjs/common';
import { WordsRepository } from './persistence/words.repository.js';
import { SessionWordsRepository } from './persistence/session-words.repository.js';
import { WordMarkingRepository } from './persistence/word-marking.repository.js';
import { WordUsageService } from './word-usage.service.js';
import { WordsController } from './words.controller.js';
import { WordsService } from './words.service.js';

@Module({
  controllers: [WordsController],
  providers: [
    WordsRepository,
    SessionWordsRepository,
    WordMarkingRepository,
    WordUsageService,
    WordsService,
  ],
  exports: [WordsRepository, SessionWordsRepository, WordUsageService],
})
export class VocabularyModule {}
