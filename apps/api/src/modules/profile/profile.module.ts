import { Module } from '@nestjs/common';
import { LearnerModelService } from './learner-model.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { ProfilesRepository } from './persistence/profiles.repository.js';

@Module({
  controllers: [ProfileController],
  providers: [LearnerModelService, ProfileService, ProfilesRepository],
  exports: [LearnerModelService],
})
export class ProfileModule {}
