import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';
import { LearnerModelService } from './learner-model.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { GoalsRepository } from './persistence/goals.repository.js';
import { ProfilesRepository } from './persistence/profiles.repository.js';

@Module({
  controllers: [ProfileController, GoalsController],
  providers: [
    GoalsRepository,
    GoalsService,
    LearnerModelService,
    ProfileService,
    ProfilesRepository,
  ],
  exports: [LearnerModelService],
})
export class ProfileModule {}
