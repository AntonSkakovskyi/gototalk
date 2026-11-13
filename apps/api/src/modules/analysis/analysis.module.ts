import { Module } from '@nestjs/common';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';

@Module({
  providers: [MistakeAnalyzerService],
  exports: [MistakeAnalyzerService],
})
export class AnalysisModule {}
