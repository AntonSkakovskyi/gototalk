import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@gototalk/shared';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/db.tokens.js';
import type { Database } from '../db/db.tokens.js';

/** Скільки чекати відповіді БД, перш ніж вважати її недоступною. */
export const HEALTH_DB_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** `select 1` до БД; будь-яка помилка або timeout дають 503 без деталей у відповіді. */
  async check(): Promise<HealthResponse> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`DB did not respond in ${HEALTH_DB_TIMEOUT_MS} ms`),
            ),
          HEALTH_DB_TIMEOUT_MS,
        );
      });
      await Promise.race([this.db.execute(sql`select 1`), timeout]);
    } catch (error) {
      // Деталі з'єднання лише в лог
      this.logger.error(
        'Health check: database is unavailable',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('Database is unavailable');
    } finally {
      clearTimeout(timer);
    }
    return { status: 'ok', db: 'ok' };
  }
}
