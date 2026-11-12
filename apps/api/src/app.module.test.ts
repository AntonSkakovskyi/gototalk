import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import type { Env } from './config/env.schema.js';
import { AppModule } from './app.module.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  PORT: '3456',
  LOG_LEVEL: 'silent',
};

describe('AppModule', () => {
  it('[TC-00-04] AppModule compiles', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);

    await moduleRef.close();
  });

  it('[TC-00-06] ConfigService returns typed values from the Zod schema', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    const config = moduleRef.get<ConfigService<Env, true>>(ConfigService);
    const port: number = config.get('PORT', { infer: true });

    expect(port).toBe(3456);
    expect(config.get('STT_PROVIDER', { infer: true })).toBe('fake');

    await moduleRef.close();
  });

  it('[TC-00-06] without DATABASE_URL the app does not start and names the variable', async () => {
    const withoutDatabaseUrl: Record<string, unknown> = { ...env };
    delete withoutDatabaseUrl['DATABASE_URL'];

    await expect(
      Test.createTestingModule({
        imports: [AppModule.register({ env: withoutDatabaseUrl })],
      }).compile(),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('[TC-00-06] deepgram and gemini stop startup with "not implemented"', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          AppModule.register({ env: { ...env, STT_PROVIDER: 'deepgram' } }),
        ],
      }).compile(),
    ).rejects.toThrow(/STT_PROVIDER.*not implemented/s);

    await expect(
      Test.createTestingModule({
        imports: [
          AppModule.register({ env: { ...env, LLM_PROVIDER: 'gemini' } }),
        ],
      }).compile(),
    ).rejects.toThrow(/LLM_PROVIDER.*not implemented/s);
  });
});
