import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import type { Env } from './core/config/env.schema.js';
import { AppModule } from './app.module.js';
import { MistakeAnalyzerService } from './modules/analysis/mistake-analyzer.service.js';
import { NextTurnService } from './modules/dialogue/next-turn.service.js';
import { LearnerModelService } from './modules/profile/learner-model.service.js';
import { SessionPlannerService } from './modules/session/session-planner.service.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789abcdef',
  PORT: '3456',
  LOG_LEVEL: 'silent',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
};

describe('AppModule', () => {
  it('[TC-00-04] AppModule compiles', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);

    await moduleRef.close();
  });

  it('[TC-00-04] AppModule resolves all 4 services with the fake providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();

    expect(moduleRef.get(LearnerModelService)).toBeInstanceOf(
      LearnerModelService,
    );
    expect(
      moduleRef.get(SessionPlannerService, { strict: false }),
    ).toBeInstanceOf(SessionPlannerService);
    expect(moduleRef.get(MistakeAnalyzerService)).toBeInstanceOf(
      MistakeAnalyzerService,
    );
    expect(moduleRef.get(NextTurnService, { strict: false })).toBeInstanceOf(
      NextTurnService,
    );

    await moduleRef.close();
  });

  it('[TC-00-04] every controller and provider in the app resolves', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env }), DiscoveryModule],
    }).compile();
    const discovery = moduleRef.get(DiscoveryService);
    const wrappers = [
      ...discovery.getControllers(),
      ...discovery.getProviders(),
    ].filter(
      (wrapper) => wrapper.isDependencyTreeStatic() && !wrapper.isTransient,
    );

    expect(discovery.getControllers().length).toBeGreaterThan(0);
    expect(discovery.getProviders().length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      expect(
        () => moduleRef.get(wrapper.token, { strict: false }),
        String(wrapper.name),
      ).not.toThrow();
    }

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
