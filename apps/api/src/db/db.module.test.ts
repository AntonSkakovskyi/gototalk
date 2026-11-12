import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { DRIZZLE, PG_POOL } from './db.tokens.js';
import type { Database } from './db.tokens.js';

// The pool connects lazily, so a dummy DATABASE_URL needs no live Postgres
const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789abcdef',
  LOG_LEVEL: 'silent',
};

describe('DbModule', () => {
  it('provides the pg pool and Drizzle without connecting to the DB', async () => {
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

  it('handles idle client errors instead of crashing the process', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();
    const pool = moduleRef.get<Pool>(PG_POOL);

    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() =>
      pool.emit('error', new Error('connection lost')),
    ).not.toThrow();

    await moduleRef.close();
  });

  it('closes the pool on application shutdown', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();
    const pool = moduleRef.get<Pool>(PG_POOL);

    expect(pool.ended).toBe(false);
    await moduleRef.close();
    expect(pool.ended).toBe(true);
  });
});
