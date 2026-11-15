import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { SessionModule } from '../session/session.module.js';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { AnswersService } from './answers.service.js';
import { AudioRetention } from './audio-retention.js';
import { DialogueController } from './dialogue.controller.js';
import { HintsController } from './hints.controller.js';
import { HintsService } from './hints.service.js';
import { NextTurnService } from './next-turn.service.js';
import { DialogueRepository } from './persistence/dialogue.repository.js';
import { HintsRepository } from './persistence/hints.repository.js';
import { TurnRepository } from './persistence/turn.repository.js';
import { TurnService } from './turn.service.js';

@Module({
  imports: [AnalysisModule, SessionModule, VocabularyModule],
  controllers: [DialogueController, HintsController],
  providers: [
    AnswersService,
    AudioRetention,
    DialogueRepository,
    HintsRepository,
    HintsService,
    NextTurnService,
    TurnRepository,
    TurnService,
  ],
})
export class DialogueModule {}
