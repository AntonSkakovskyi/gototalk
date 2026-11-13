import 'reflect-metadata';
import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ERROR_CODES, PLAN_QUESTIONS } from '@gototalk/shared';
import type { Goal, PlanSessionRequest, Profile } from '@gototalk/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from '../../integrations/language-model/fake-language-model.js';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import type {
  LanguageModelPort,
  PlanSessionInput,
} from '../../integrations/language-model/language-model.port.js';
import type { GoalsService } from '../profile/goals.service.js';
import type { LearnerModelService } from '../profile/learner-model.service.js';
import type { WeakArea } from '../profile/learner-model.types.js';
import type { ProfileService } from '../profile/profile.service.js';
import { SessionPlannerService } from './session-planner.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SENTINEL = 'SENTINEL-user-text-do-not-log';
const PROFILE: Profile = {
  level: 'B1',
  scenes: ['work_meetings'],
  updatedAt: '2026-11-13T10:00:00.000Z',
};
const GOAL: Goal = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Speak at meetings',
  status: 'active',
  createdAt: '2026-11-13T10:00:00.000Z',
};
const WEAK_AREAS: WeakArea[] = [
  { category: 'verb_tense', frequency: 4, lastSeenAt: null },
  { category: 'articles', frequency: 2, lastSeenAt: null },
];
const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5'];
const MODEL_PLAN = { topic: 'Model topic', questions: QUESTIONS };
const REQUEST: PlanSessionRequest = { previousTopics: ['Weekend plans'] };

function setup(
  planSession: unknown = vi.fn().mockResolvedValue(MODEL_PLAN),
  profileGet: unknown = vi.fn().mockResolvedValue(PROFILE),
) {
  const profiles = { get: profileGet };
  const goals = { listActive: vi.fn().mockResolvedValue([GOAL]) };
  const learnerModel = { weakAreas: vi.fn().mockResolvedValue(WEAK_AREAS) };
  const model = { planSession };
  const service = new SessionPlannerService(
    model as unknown as LanguageModelPort,
    profiles as unknown as ProfileService,
    goals as unknown as GoalsService,
    learnerModel as unknown as LearnerModelService,
  );
  return { service, model, goals, learnerModel };
}

function fakeModelPlanSession(input: PlanSessionInput): Promise<unknown> {
  return new FakeLanguageModel().planSession(input);
}

function silenceWarnings() {
  return vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionPlannerService.plan', () => {
  it('[TC-03-01] sends the model the profile, active goals and top 3 weak areas', async () => {
    const planSession = vi.fn().mockResolvedValue(MODEL_PLAN);
    const { service, goals, learnerModel } = setup(planSession);

    await service.plan(USER_ID, REQUEST);

    expect(goals.listActive).toHaveBeenCalledWith(USER_ID);
    expect(learnerModel.weakAreas).toHaveBeenCalledWith(USER_ID, 3);
    expect(planSession).toHaveBeenCalledWith({
      level: 'B1',
      scenes: ['work_meetings'],
      goals: ['Speak at meetings'],
      patterns: ['verb_tense', 'articles'],
      previousTopics: ['Weekend plans'],
    });
  });

  it('[TC-03-01] returns the model plan as suggested', async () => {
    const { service } = setup();

    await expect(service.plan(USER_ID, REQUEST)).resolves.toEqual({
      ...MODEL_PLAN,
      topicSource: 'suggested',
    });
  });

  it('[TC-03-01] retries once after an invalid response and returns the valid plan', async () => {
    const planSession = vi
      .fn()
      .mockResolvedValueOnce({ topic: '', questions: [] })
      .mockResolvedValueOnce(MODEL_PLAN);
    const { service } = setup(planSession);
    silenceWarnings();

    await expect(service.plan(USER_ID, REQUEST)).resolves.toEqual({
      ...MODEL_PLAN,
      topicSource: 'suggested',
    });

    expect(planSession).toHaveBeenCalledTimes(2);
  });

  it('[TC-03-01] answers 502 LANGUAGE_MODEL_INVALID_RESPONSE after two invalid responses', async () => {
    const planSession = vi.fn().mockResolvedValue({ topic: 'Only a topic' });
    const { service } = setup(planSession);
    silenceWarnings();

    const error = await failureOf(service.plan(USER_ID, REQUEST));

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).getResponse()).toMatchObject({
      code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
    });
    expect(planSession).toHaveBeenCalledTimes(2);
  });

  it('[TC-03-02] uses the custom topic as entered and ignores the model topic', async () => {
    const planSession = vi.fn().mockResolvedValue(MODEL_PLAN);
    const { service } = setup(planSession);

    const plan = await service.plan(USER_ID, {
      previousTopics: [],
      customTopic: 'My cat',
    });

    expect(plan).toEqual({
      topic: 'My cat',
      topicSource: 'custom',
      questions: QUESTIONS,
    });
    expect(planSession).toHaveBeenCalledWith(
      expect.objectContaining({ customTopic: 'My cat' }),
    );
  });

  it('[TC-03-01] propagates the missing profile 404 without calling the model', async () => {
    const notFound = new NotFoundException({
      code: ERROR_CODES.PROFILE_NOT_FOUND,
      message: 'The profile has not been created yet',
    });
    const planSession = vi.fn();
    const { service } = setup(planSession, vi.fn().mockRejectedValue(notFound));

    await expect(service.plan(USER_ID, REQUEST)).rejects.toBe(notFound);

    expect(planSession).not.toHaveBeenCalled();
  });

  it('[TC-04-08] answers 503 LANGUAGE_MODEL_UNAVAILABLE when the model is unavailable, without a retry', async () => {
    const planSession = vi
      .fn()
      .mockRejectedValue(new LanguageModelUnavailableError());
    const { service } = setup(planSession);
    const warn = silenceWarnings();

    const error = await failureOf(service.plan(USER_ID, REQUEST));

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
    });
    expect(planSession).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Language model unavailable');
  });

  it('[TC-03-01] propagates provider errors untouched', async () => {
    const outage = new Error('provider is down');
    const { service } = setup(vi.fn().mockRejectedValue(outage));

    await expect(service.plan(USER_ID, REQUEST)).rejects.toBe(outage);
  });

  it('[TC-03-01] logs no user text when the model response is invalid', async () => {
    const planSession = vi
      .fn()
      .mockResolvedValue({ topic: SENTINEL, questions: [SENTINEL] });
    const { service } = setup(planSession);
    const warn = silenceWarnings();

    await failureOf(
      service.plan(USER_ID, { previousTopics: [], customTopic: SENTINEL }),
    );

    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-03-01] logs only the attempt and issue paths and codes through a real Nest Logger', async () => {
    const planSession = vi.fn().mockResolvedValue({ topic: 7, note: SENTINEL });
    const { service } = setup(planSession);
    const warn = silenceWarnings();

    await failureOf(service.plan(USER_ID, REQUEST));

    expect(warn.mock.calls).toEqual([
      [
        {
          attempt: 1,
          issues: [
            { path: 'topic', code: 'invalid_type' },
            { path: 'questions', code: 'invalid_type' },
          ],
        },
        'Language model response failed validation',
      ],
      [
        expect.objectContaining({ attempt: 2 }),
        'Language model response failed validation',
      ],
    ]);
  });

  it('[TC-03-01] works with the Fake model: a verb_tense pattern shapes the first question', async () => {
    const { service } = setup(fakeModelPlanSession);

    const plan = await service.plan(USER_ID, { previousTopics: [] });

    expect(plan.topicSource).toBe('suggested');
    expect(plan.questions).toHaveLength(PLAN_QUESTIONS);
    expect(plan.questions[0]).toBe('Tell me what you did yesterday at work.');
  });

  it('[TC-03-02] works with the Fake model: a custom topic uses the custom template', async () => {
    const { service } = setup(fakeModelPlanSession);

    const plan = await service.plan(USER_ID, {
      previousTopics: [],
      customTopic: 'My cat',
    });

    expect(plan).toMatchObject({ topic: 'My cat', topicSource: 'custom' });
    expect(plan.questions[1]).toBe(
      'Why did you choose to talk about "My cat"?',
    );
  });
});
