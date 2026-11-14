import { Inject, Injectable } from '@nestjs/common';
import { SessionReportSchema } from '@gototalk/shared';
import type { SessionReport } from '@gototalk/shared';
import { isSessionId, sessionNotFound } from '../session/session.errors.js';
import { ReportRepository } from './persistence/report.repository.js';
import { ReportGeneratorService } from './report-generator.service.js';
import { SessionNotFinishedError } from './report.errors.js';

@Injectable()
export class ReportService {
  constructor(
    @Inject(ReportRepository)
    private readonly repository: Pick<
      ReportRepository,
      | 'findOwnedSession'
      | 'stats'
      | 'categories'
      | 'theoryLinks'
      | 'sessionWords'
    >,
    @Inject(ReportGeneratorService)
    private readonly generator: Pick<ReportGeneratorService, 'ensure'>,
  ) {}

  async get(userId: string, sessionId: string): Promise<SessionReport> {
    if (!isSessionId(sessionId)) throw sessionNotFound();
    const session = await this.repository.findOwnedSession(userId, sessionId);
    if (!session) throw sessionNotFound();
    if (session.status === 'active') throw new SessionNotFinishedError();

    // ensure() may complete pending analyses, so the aggregates are read after it
    const summary = await this.generator.ensure(userId, sessionId);
    const [stats, categories, words] = await Promise.all([
      this.repository.stats(userId, sessionId),
      this.repository.categories(userId, sessionId),
      this.repository.sessionWords(userId, sessionId),
    ]);
    const links = await this.repository.theoryLinks(
      categories.map((item) => item.category),
    );

    return SessionReportSchema.parse({
      sessionId,
      answers: stats.answers,
      durationSeconds: stats.durationSeconds,
      summary,
      categories: categories.map(({ category, count }) => ({
        category,
        count,
        theoryLinks: links.get(category) ?? [],
      })),
      words,
    });
  }
}
