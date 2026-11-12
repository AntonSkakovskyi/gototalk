import { Global, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Env } from '../config/env.schema.js';
import { DRIZZLE, PG_POOL, dbSchema } from './db.tokens.js';
import type { Database } from './db.tokens.js';

/** Закриває пул при завершенні застосунку (`enableShutdownHooks` у main.ts або `app.close()`). */
class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    // Повторний end() у pg кидає помилку
    if (!this.pool.ended) {
      await this.pool.end();
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      // Пул ліниво: з'єднання відкривається при першому запиті
      useFactory: (config: ConfigService<Env, true>): pg.Pool =>
        new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool): Database =>
        drizzle({ client: pool, schema: dbSchema }),
    },
    PoolShutdown,
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DbModule {}
