import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { SessionModule } from '../session/session.module.js';
import { ReportRepository } from './persistence/report.repository.js';
import { ReportController } from './report.controller.js';
import { ReportGeneratorService } from './report-generator.service.js';
import { ReportService } from './report.service.js';
import { SessionFinishController } from './session-finish.controller.js';
import { SessionFinishService } from './session-finish.service.js';

@Module({
  imports: [AnalysisModule, SessionModule],
  controllers: [ReportController, SessionFinishController],
  providers: [
    ReportRepository,
    ReportGeneratorService,
    ReportService,
    SessionFinishService,
  ],
  exports: [ReportRepository, ReportGeneratorService],
})
export class ReportModule {}
