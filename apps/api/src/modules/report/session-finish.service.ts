import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Session } from '@gototalk/shared';
import { SessionsService } from '../session/sessions.service.js';
import { ReportGeneratorService } from './report-generator.service.js';

@Injectable()
export class SessionFinishService {
  private readonly logger = new Logger(SessionFinishService.name);

  constructor(
    @Inject(SessionsService)
    private readonly sessions: Pick<SessionsService, 'finish'>,
    @Inject(ReportGeneratorService)
    private readonly reports: Pick<ReportGeneratorService, 'ensure'>,
  ) {}

  async finish(userId: string, id: string): Promise<Session> {
    const session = await this.sessions.finish(userId, id);
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
}
