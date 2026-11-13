import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SessionDetails, StartSessionRequest } from '@gototalk/shared';
import { SessionOwnerMissingError } from './session.errors.js';
import { SessionsRepository } from './sessions.repository.js';

@Injectable()
export class SessionsService {
  constructor(private readonly sessions: SessionsRepository) {}

  async start(
    userId: string,
    request: StartSessionRequest,
  ): Promise<SessionDetails> {
    try {
      return await this.sessions.start(userId, request);
    } catch (error) {
      if (error instanceof SessionOwnerMissingError) {
        throw new UnauthorizedException('User no longer exists');
      }
      throw error;
    }
  }
}
