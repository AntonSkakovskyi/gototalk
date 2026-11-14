import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { ReportRepository } from './persistence/report.repository.js';
import { ReportController } from './report.controller.js';
import { ReportGeneratorService } from './report-generator.service.js';
import { ReportService } from './report.service.js';

@Module({
  imports: [AnalysisModule],
  controllers: [ReportController],
  providers: [ReportRepository, ReportGeneratorService, ReportService],
  exports: [ReportRepository, ReportGeneratorService],
})
export class ReportModule {}
