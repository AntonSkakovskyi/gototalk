import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';
import { LearnerModelService } from './learner-model.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { GoalsRepository } from './persistence/goals.repository.js';
import { LearnerModelRepository } from './persistence/learner-model.repository.js';
import { ProfilesRepository } from './persistence/profiles.repository.js';

@Module({
  controllers: [ProfileController, GoalsController],
  providers: [
    GoalsRepository,
    GoalsService,
    LearnerModelRepository,
    LearnerModelService,
    ProfileService,
    ProfilesRepository,
  ],
  exports: [GoalsService, LearnerModelService, ProfileService],
})
export class ProfileModule {}
