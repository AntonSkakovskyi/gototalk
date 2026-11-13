import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { NextTurnService } from './modules/dialogue/next-turn.service.js';
import { MistakeAnalyzerService } from './modules/analysis/mistake-analyzer.service.js';
import { LearnerModelService } from './modules/profile/learner-model.service.js';
import { SessionPlannerService } from './modules/session/session-planner.service.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789abcdef',
  LOG_LEVEL: 'silent',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
};

describe('Core service skeletons', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('[TC-00-04] AppModule resolves all 4 services with the fake providers', () => {
    expect(moduleRef.get(LearnerModelService)).toBeInstanceOf(
      LearnerModelService,
    );
    expect(
      moduleRef.get(SessionPlannerService, { strict: false }),
    ).toBeInstanceOf(SessionPlannerService);
    expect(moduleRef.get(MistakeAnalyzerService)).toBeInstanceOf(
      MistakeAnalyzerService,
    );
    expect(moduleRef.get(NextTurnService)).toBeInstanceOf(NextTurnService);
  });
});
