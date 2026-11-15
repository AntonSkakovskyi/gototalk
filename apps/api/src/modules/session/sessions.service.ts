import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RECENT_SESSIONS_LIMIT } from '@gototalk/shared';
import type {
  PageQuery,
  Session,
  SessionDetails,
  SessionPage,
  StartSessionRequest,
} from '@gototalk/shared';
import { afterOf, toCursorPage } from '../../common/pagination/keyset-page.js';
import {
  SessionOwnerMissingError,
  isSessionId,
  sessionNotFound,
} from './session.errors.js';
import { SessionsRepository } from './persistence/sessions.repository.js';

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

  async history(userId: string, query: PageQuery): Promise<SessionPage> {
    const page = await this.sessions.listPage(userId, {
      after: afterOf(query.cursor),
      limit: query.limit,
    });
    return toCursorPage(page);
  }

  async finish(userId: string, id: string): Promise<Session> {
    if (!isSessionId(id)) throw sessionNotFound();
    const session = await this.sessions.finish(userId, id);
    if (!session) throw sessionNotFound();
    return session;
  }

  async details(userId: string, id: string): Promise<SessionDetails> {
    if (!isSessionId(id)) throw sessionNotFound();
    const details = await this.sessions.findDetails(userId, id);
    if (!details) throw sessionNotFound();
    return details;
  }
}
