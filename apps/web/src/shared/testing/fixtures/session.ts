import type {
  MistakeView,
  Session,
  SessionDetails,
  SessionPlan,
  TurnResult,
  Utterance,
} from '@gototalk/shared';

export function testSession(overrides: Partial<Session> = {}): Session {
  return {
    id: '7c2e8b64-5f0a-4d1b-8e3a-2a9b4c6d0001',
    topic: 'Planning a team offsite',
    topicSource: 'suggested',
    feedbackMode: 'immediate',
    status: 'active',
    startedAt: '2026-11-13T10:00:00.000Z',
    endedAt: null,
    ...overrides,
  };
}

export function testUtterance(overrides: Partial<Utterance> = {}): Utterance {
  return {
    id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0001',
    seq: 1,
    role: 'assistant',
    text: 'What would you like to do at the team offsite?',
    analysisStatus: 'skipped',
    mistakes: [],
    better: [],
    ...overrides,
  };
}

export function testSessionDetails(
  overrides: Partial<SessionDetails> = {},
): SessionDetails {
  return {
    ...testSession(),
    utterances: [testUtterance()],
    planRemaining: 4,
    ...overrides,
  };
}

export function testSessionPlan(
  overrides: Partial<SessionPlan> = {},
): SessionPlan {
  return {
    topic: 'Planning a team offsite',
    topicSource: 'suggested',
    questions: [
      'What would you like to do at the team offsite?',
      'Where would the team go if the budget were unlimited?',
      'Who should organise the schedule, and why?',
      'What could go wrong, and how would you prepare?',
      'How would you measure whether the offsite was a success?',
    ],
    ...overrides,
  };
}

export function testMistake(overrides: Partial<MistakeView> = {}): MistakeView {
  return {
    id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0001',
    start: 2,
    end: 4,
    original: 'go',
    suggestion: 'went',
    category: 'verb_tense',
    explanationEn: 'Use the past simple for finished actions.',
    translationUk: 'Використовуйте Past Simple для завершених дій.',
    isFalse: false,
    ...overrides,
  };
}

export function testTurnResult(
  overrides: Partial<TurnResult> = {},
): TurnResult {
  return {
    utterance: testUtterance({
      id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0002',
      seq: 2,
      role: 'user',
      text: 'I go to the offsite yesterday',
      analysisStatus: 'done',
      mistakes: [testMistake()],
    }),
    reply: testUtterance({
      id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0003',
      seq: 3,
      text: 'Where would the team go if the budget were unlimited?',
    }),
    planRemaining: 3,
    ...overrides,
  };
}
