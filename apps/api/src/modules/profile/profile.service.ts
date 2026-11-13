import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { Profile, UpdateProfileRequest } from '@gototalk/shared';
import {
  ProfileOwnerMissingError,
  ProfilesRepository,
} from './persistence/profiles.repository.js';
import type { ProfileRecord } from './persistence/profiles.repository.js';

function toProfile(record: ProfileRecord): Profile {
  return {
    level: record.level,
    scenes: record.scenes,
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProfileService {
  constructor(private readonly profiles: ProfilesRepository) {}

  async get(userId: string): Promise<Profile> {
    const record = await this.profiles.findByUserId(userId);
    if (!record) {
      throw new NotFoundException({
        code: ERROR_CODES.PROFILE_NOT_FOUND,
        message: 'The profile has not been created yet',
      });
    }
    return toProfile(record);
  }

  async update(userId: string, input: UpdateProfileRequest): Promise<Profile> {
    try {
      return toProfile(await this.profiles.upsert(userId, input));
    } catch (error) {
      if (error instanceof ProfileOwnerMissingError) {
        throw new UnauthorizedException('User no longer exists');
      }
      throw error;
    }
  }
}
