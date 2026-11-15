import { Module } from '@nestjs/common';
import { LearnerModelController } from './learner-model.controller.js';
import { LearnerModelService } from './learner-model.service.js';
import { LearnerModelRepository } from './persistence/learner-model.repository.js';

@Module({
  controllers: [LearnerModelController],
  providers: [LearnerModelRepository, LearnerModelService],
  exports: [LearnerModelService],
})
export class LearnerModelModule {}
