import { vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { SessionDetails, Utterance } from '@gototalk/shared';
import type { AnalysisOutcome } from '../../analysis/mistake-analyzer.types.js';
import type { StoredUtterance, TurnState } from '../lib/turn-state.js';
import { TurnService } from '../turn.service.js';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const SESSION_ID = '33333333-3333-4333-8333-333333333333';
export const TARGET_ID = '44444444-4444-4444-8444-444444444444';
export const SENTINEL = 'SENTINEL-user-text-do-not-log';
export const DONE: AnalysisOutcome = {
  status: 'done',
  mistakes: [],
  better: [],
  promptVersion: 'error-analysis.v1',
  model: 'fake',
};

export const question: StoredUtterance = {
  id: '55555555-5555-4555-8555-555555555555',
  seq: 1,
  role: 'assistant',
  textVerbatim: 'q1',
  textClean: null,
  analysisStatus: 'skipped',
};
export const answer: StoredUtterance = {
  id: TARGET_ID,
  seq: 2,
  role: 'user',
  textVerbatim: SENTINEL,
  textClean: 'cleaned answer',
  analysisStatus: 'pending',
};
export const reply: StoredUtterance = {
  ...question,
  id: '66666666-6666-4666-8666-666666666666',
  seq: 3,
  textVerbatim: 'q2',
};

export function state(overrides: Partial<TurnState> = {}): TurnState {
  return {
    sessionActive: true,
    topic: 'Work',
    planQuestions: ['q1', 'q2', 'q3'],
    utterances: [question, answer],
    target: answer,
    ...overrides,
  };
}

export function view(id: string, seq: number): Utterance {
  return {
    id,
    seq,
    role: seq % 2 === 0 ? 'user' : 'assistant',
    text: 'text',
    analysisStatus: 'done',
    mistakes: [],
    better: [],
  };
}

export const DETAILS: SessionDetails = {
  id: SESSION_ID,
  topic: 'Work',
  topicSource: 'suggested',
  feedbackMode: 'deferred',
  status: 'active',
  startedAt: '2026-11-13T10:00:00.000Z',
  endedAt: null,
  utterances: [view(question.id, 1), view(TARGET_ID, 2), view(reply.id, 3)],
  planRemaining: 1,
};

export function setup(initial: TurnState = state()) {
  const loadState = vi.fn().mockResolvedValue(initial);
  const persist = vi.fn().mockResolvedValue(undefined);
  const findDetails = vi.fn().mockResolvedValue(DETAILS);
  const analyze = vi.fn().mockResolvedValue(DONE);
  const nextTurn = vi.fn().mockResolvedValue({ question: 'q2' });
  const service = new TurnService(
    { loadState, persist },
    { findDetails },
    { analyze },
    { nextTurn },
  );
  return { service, loadState, persist, findDetails, analyze, nextTurn };
}

export function run(service: TurnService) {
  return service.run(USER_ID, SESSION_ID, TARGET_ID);
}

export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

export function silenceWarnings() {
  return vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
}
