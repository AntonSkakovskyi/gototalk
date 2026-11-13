import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module.js';
import { SessionPlannerService } from './session-planner.service.js';
import { SessionsController } from './sessions.controller.js';

@Module({
  imports: [ProfileModule],
  controllers: [SessionsController],
  providers: [SessionPlannerService],
  exports: [SessionPlannerService],
})
export class SessionModule {}
