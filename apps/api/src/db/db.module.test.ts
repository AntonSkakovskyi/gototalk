import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { DRIZZLE, PG_POOL } from './db.tokens.js';
import type { Database } from './db.tokens.js';

// Фіктивний DATABASE_URL: пул створюється ліниво, тож живий Postgres не потрібен
const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  LOG_LEVEL: 'silent',
};

describe('DbModule', () => {
  it('віддає пул pg і Drizzle без підключення до БД', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    const pool = moduleRef.get<Pool>(PG_POOL);
    const db = moduleRef.get<Database>(DRIZZLE);

    expect(pool.totalCount).toBe(0);
    expect(db.query.users).toBeDefined();
    expect(db.query.words).toBeDefined();

    await moduleRef.close();
  });

  it('закриває пул при завершенні застосунку', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();
    const pool = moduleRef.get<Pool>(PG_POOL);

    expect(pool.ended).toBe(false);
    await moduleRef.close();
    expect(pool.ended).toBe(true);
  });
});
