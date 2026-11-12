import { Module } from '@nestjs/common';
import { LearnerModelService } from './learner-model.service.js';

@Module({
  providers: [LearnerModelService],
  exports: [LearnerModelService],
})
export class ProfileModule {}
