import { Module } from '@nestjs/common';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';
import { MistakesController } from './mistakes.controller.js';
import { MistakesService } from './mistakes.service.js';
import { MistakesRepository } from './persistence/mistakes.repository.js';
import { PatternsRepository } from './persistence/patterns.repository.js';

@Module({
  controllers: [MistakesController],
  providers: [
    MistakeAnalyzerService,
    MistakesRepository,
    MistakesService,
    PatternsRepository,
  ],
  exports: [MistakeAnalyzerService, PatternsRepository],
})
export class AnalysisModule {}
