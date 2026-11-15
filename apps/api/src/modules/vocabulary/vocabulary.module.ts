import { Module } from '@nestjs/common';
import { WordsRepository } from './persistence/words.repository.js';
import { SessionWordsRepository } from './persistence/session-words.repository.js';
import { WordMarkingRepository } from './persistence/word-marking.repository.js';
import { WordsPageRepository } from './persistence/words-page.repository.js';
import { VocabularyWriter } from './vocabulary-writer.service.js';
import { WordUsageService } from './word-usage.service.js';
import { WordsController } from './words.controller.js';
import { WordsService } from './words.service.js';

@Module({
  controllers: [WordsController],
  providers: [
    WordsRepository,
    SessionWordsRepository,
    WordMarkingRepository,
    WordsPageRepository,
    VocabularyWriter,
    WordUsageService,
    WordsService,
  ],
  exports: [
    WordsRepository,
    SessionWordsRepository,
    VocabularyWriter,
    WordUsageService,
  ],
})
export class VocabularyModule {}
