import { Module } from '@nestjs/common';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';
import { MistakesController } from './mistakes.controller.js';
import { MistakesService } from './mistakes.service.js';
import { PendingAnalysisService } from './pending-analysis.service.js';
import { AnalysisWriter } from './persistence/analysis-writer.js';
import { MistakesRepository } from './persistence/mistakes.repository.js';
import { PendingAnalysisRepository } from './persistence/pending-analysis.repository.js';
import { PatternsRepository } from './persistence/patterns.repository.js';

@Module({
  imports: [VocabularyModule],
  controllers: [MistakesController],
  providers: [
    AnalysisWriter,
    MistakeAnalyzerService,
    MistakesRepository,
    MistakesService,
    PendingAnalysisRepository,
    PendingAnalysisService,
    PatternsRepository,
  ],
  exports: [
    AnalysisWriter,
    MistakeAnalyzerService,
    PatternsRepository,
    PendingAnalysisService,
  ],
})
export class AnalysisModule {}
