import { Module } from '@nestjs/common';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { HintsController } from './hints.controller.js';
import { HintsService } from './hints.service.js';
import { HintsRepository } from './persistence/hints.repository.js';

@Module({
  imports: [VocabularyModule],
  controllers: [HintsController],
  providers: [HintsRepository, HintsService],
})
export class HintModule {}
