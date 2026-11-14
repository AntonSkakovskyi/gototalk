import { Module } from '@nestjs/common';
import { WordsRepository } from './persistence/words.repository.js';
import { WordUsageService } from './word-usage.service.js';

@Module({
  providers: [WordsRepository, WordUsageService],
  exports: [WordUsageService],
})
export class VocabularyModule {}
