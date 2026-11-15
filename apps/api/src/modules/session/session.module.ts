import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module.js';
import { ReportModule } from '../report/report.module.js';
import { SessionPlannerService } from './session-planner.service.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [ProfileModule, ReportModule],
  controllers: [SessionsController],
  providers: [SessionPlannerService, SessionsService, SessionsRepository],
  exports: [SessionsRepository],
})
export class SessionModule {}
