import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RECENT_SESSIONS_LIMIT } from '@gototalk/shared';
import type {
  HistoryQuery,
  Session,
  SessionDetails,
  SessionPage,
  StartSessionRequest,
} from '@gototalk/shared';
import { decodeCursor, encodeCursor } from '../../common/keyset-cursor.js';
import { ReportGeneratorService } from '../report/report-generator.service.js';
import {
  SessionOwnerMissingError,
  isSessionId,
  sessionNotFound,
} from './session.errors.js';
import { SessionsRepository } from './sessions.repository.js';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessions: SessionsRepository,
    @Inject(ReportGeneratorService)
    private readonly reports: Pick<ReportGeneratorService, 'ensure'>,
  ) {}

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

  async history(userId: string, query: HistoryQuery): Promise<SessionPage> {
    const after =
      query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const { items, next } = await this.sessions.listPage(userId, {
      after,
      limit: query.limit,
    });
    return { items, nextCursor: next === null ? null : encodeCursor(next) };
  }

  async finish(userId: string, id: string): Promise<Session> {
    if (!isSessionId(id)) throw sessionNotFound();
    const session = await this.sessions.finish(userId, id);
    if (!session) throw sessionNotFound();
    await this.ensureReport(userId, id);
    return session;
  }

  // The finish succeeds without a report: a later report read generates it
  private async ensureReport(userId: string, id: string): Promise<void> {
    try {
      await this.reports.ensure(userId, id);
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Report generation failed on finish: ${name}`);
    }
  }

  async details(userId: string, id: string): Promise<SessionDetails> {
    if (!isSessionId(id)) throw sessionNotFound();
    const details = await this.sessions.findDetails(userId, id);
    if (!details) throw sessionNotFound();
    return details;
  }
}
