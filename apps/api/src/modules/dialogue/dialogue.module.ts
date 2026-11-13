import { Module } from '@nestjs/common';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { AnswersService } from './answers.service.js';
import { DialogueController } from './dialogue.controller.js';
import { NextTurnService } from './next-turn.service.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';

@Module({
  imports: [VocabularyModule],
  controllers: [DialogueController],
  providers: [AnswersService, DialogueRepository, NextTurnService],
  exports: [NextTurnService],
})
export class DialogueModule {}
