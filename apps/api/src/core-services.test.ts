import 'reflect-metadata';
import { NotImplementedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { DialogueService } from './dialogue/dialogue.service.js';
import { MistakeAnalyzerService } from './analysis/mistake-analyzer.service.js';
import { LearnerModelService } from './profile/learner-model.service.js';
import { SessionPlannerService } from './session/session-planner.service.js';

const env = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/gototalk_test',
  LOG_LEVEL: 'silent',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
};

const userId = '00000000-0000-4000-8000-000000000001';

describe('Скелети сервісів ядра', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ env })],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('[TC-00-04] AppModule резолвить усі 4 сервіси з Fake-провайдерами', () => {
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

  it('[TC-00-04] LearnerModelService: методи кидають NotImplementedException з посиланням на spec', async () => {
    const service = moduleRef.get(LearnerModelService);

    await expect(service.weakAreas(userId)).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.weakAreas(userId)).rejects.toThrow(/spec 02/);
    await expect(service.vocabularyStats(userId)).rejects.toThrow(/spec 02/);
    await expect(
      service.applyAnalysis({
        userId,
        utteranceId: userId,
        textClean: 'I go there yesterday.',
        analysis: { mistakes: [], better: [] },
      }),
    ).rejects.toThrow(/spec 04/);
  });

  it('[TC-00-04] SessionPlannerService.planSession посилається на spec 03', async () => {
    const service = moduleRef.get(SessionPlannerService);

    await expect(service.planSession({ userId })).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.planSession({ userId })).rejects.toThrow(/spec 03/);
  });

  it('[TC-00-04] MistakeAnalyzerService: analyzeUtterance і groupIntoPatterns посилаються на spec 04', async () => {
    const service = moduleRef.get(MistakeAnalyzerService);

    await expect(service.analyzeUtterance('I go there.')).rejects.toThrow(
      NotImplementedException,
    );
    await expect(service.analyzeUtterance('I go there.')).rejects.toThrow(
      /spec 04/,
    );
    expect(() => service.groupIntoPatterns([])).toThrow(
      NotImplementedException,
    );
    expect(() => service.groupIntoPatterns([])).toThrow(/spec 04/);
  });

  it('[TC-00-04] DialogueService.nextTurn посилається на spec 04', async () => {
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
    await expect(service.nextTurn(input)).rejects.toThrow(/spec 04/);
  });
});
