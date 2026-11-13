import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  RECENT_SESSIONS_LIMIT,
  SessionSchema,
} from '@gototalk/shared';
import type {
  Session,
  SessionDetails,
  StartSessionRequest,
} from '@gototalk/shared';
import { SessionOwnerMissingError } from './session.errors.js';
import { SessionsRepository } from './sessions.repository.js';

function sessionNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.SESSION_NOT_FOUND,
    message: 'The session was not found',
  });
}

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

  list(userId: string): Promise<Session[]> {
    return this.sessions.listRecent(userId, RECENT_SESSIONS_LIMIT);
  }

  async details(userId: string, id: string): Promise<SessionDetails> {
    if (!SessionSchema.shape.id.safeParse(id).success) throw sessionNotFound();
    const details = await this.sessions.findDetails(userId, id);
    if (!details) throw sessionNotFound();
    return details;
  }
}
