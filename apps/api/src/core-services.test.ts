import 'reflect-metadata';
import { NotImplementedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { DialogueService } from './modules/dialogue/dialogue.service.js';
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

const userId = '00000000-0000-4000-8000-000000000001';

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
    expect(moduleRef.get(SessionPlannerService)).toBeInstanceOf(
      SessionPlannerService,
    );
    expect(moduleRef.get(MistakeAnalyzerService)).toBeInstanceOf(
      MistakeAnalyzerService,
    );
    expect(moduleRef.get(DialogueService)).toBeInstanceOf(DialogueService);
  });

  it('[TC-00-04] LearnerModelService.applyAnalysis points to spec 04', async () => {
    const service = moduleRef.get(LearnerModelService);
    const input = {
      userId,
      utteranceId: userId,
      textClean: 'I go there yesterday.',
      analysis: { mistakes: [], better: [] },
    };

    await expect(service.applyAnalysis(input)).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.applyAnalysis(input)).rejects.toThrow(/04-dialog/);
  });

  it('[TC-00-04] MistakeAnalyzerService: analyzeUtterance and groupIntoPatterns point to spec 04', async () => {
    const service = moduleRef.get(MistakeAnalyzerService);

    await expect(service.analyzeUtterance('I go there.')).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.analyzeUtterance('I go there.')).rejects.toThrow(
      /04-dialog/,
    );
    expect(() => service.groupIntoPatterns([])).toThrow(
      NotImplementedException,
    );
    expect(() => service.groupIntoPatterns([])).toThrow(/04-dialog/);
  });

  it('[TC-00-04] DialogueService.nextTurn points to spec 04', async () => {
    const service = moduleRef.get(DialogueService);
    const input = {
      plan: {
        topic: 'Work',
        questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
      },
      history: [],
    };

    await expect(service.nextTurn(input)).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.nextTurn(input)).rejects.toThrow(/04-dialog/);
  });
});
