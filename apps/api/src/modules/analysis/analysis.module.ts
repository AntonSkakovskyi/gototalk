import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module.js';
import { MistakeAnalyzerService } from './mistake-analyzer.service.js';

@Module({
  imports: [ProfileModule],
  providers: [MistakeAnalyzerService],
  exports: [MistakeAnalyzerService],
})
export class AnalysisModule {}
