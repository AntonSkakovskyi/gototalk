import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { ReportRepository } from './persistence/report.repository.js';
import { ReportGeneratorService } from './report-generator.service.js';

@Module({
  imports: [AnalysisModule],
  providers: [ReportRepository, ReportGeneratorService],
  exports: [ReportRepository, ReportGeneratorService],
})
export class ReportModule {}
