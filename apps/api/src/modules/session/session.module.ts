import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module.js';
import { SessionPlannerService } from './session-planner.service.js';

@Module({
  imports: [ProfileModule],
  providers: [SessionPlannerService],
  exports: [SessionPlannerService],
})
export class SessionModule {}
