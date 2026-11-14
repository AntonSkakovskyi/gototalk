import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { SessionModule } from '../session/session.module.js';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { AnswersService } from './answers.service.js';
import { AudioRetention } from './audio-retention.js';
import { DialogueController } from './dialogue.controller.js';
import { NextTurnService } from './next-turn.service.js';
import { AnalysisWriter } from './persistence/analysis-writer.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';
import { TurnRepository } from './persistence/turn.repository.js';
import { TurnService } from './turn.service.js';

@Module({
  imports: [AnalysisModule, SessionModule, VocabularyModule],
  controllers: [DialogueController],
  providers: [
    AnalysisWriter,
    AnswersService,
    AudioRetention,
    DialogueRepository,
    NextTurnService,
    TurnRepository,
    TurnService,
  ],
})
export class DialogueModule {}
