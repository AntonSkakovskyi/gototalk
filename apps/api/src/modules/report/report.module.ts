import { Module } from '@nestjs/common';
import { ReportRepository } from './persistence/report.repository.js';

@Module({
  providers: [ReportRepository],
  exports: [ReportRepository],
})
export class ReportModule {}
