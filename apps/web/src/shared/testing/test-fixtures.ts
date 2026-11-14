import type {
  AuthResponse,
  Goal,
  LearnerModel,
  Me,
  MistakeView,
  Profile,
  Session,
  SessionDetails,
  SessionPlan,
  TurnResult,
  Utterance,
} from '@gototalk/shared';

export const TEST_USER: Me = {
  id: '0b7f4f7e-3d3a-4f0a-9a57-0c6d3b1a0001',
  email: 'anna@example.com',
  consentAt: null,
};

export function authResponse(
  accessToken = 'access-1',
  user: Me = TEST_USER,
): AuthResponse {
  return { accessToken, user };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message = 'Error message',
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

export const TEST_PROFILE: Profile = {
  level: 'B1',
  scenes: ['work_meetings', 'small_talk'],
  updatedAt: '2026-11-13T10:00:00.000Z',
};

export function testGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: '5d1c9a52-8a35-4e0e-9a0c-1f0d6c2b0001',
    title: 'Speak fluently',
    status: 'active',
    createdAt: '2026-11-13T10:00:00.000Z',
    ...overrides,
  };
}

export const TEST_LEARNER_MODEL: LearnerModel = {
  weakAreas: [
    {
      category: 'articles',
      frequency: 7,
      lastSeenAt: '2026-11-12T09:30:00.000Z',
    },
    { category: 'verb_tense', frequency: 3, lastSeenAt: null },
  ],
  vocabulary: { new: 12, partial: 5, passive: 3, active: 1 },
};

export const TOP_FIVE_LEARNER_MODEL: LearnerModel = {
  weakAreas: [
    { category: 'articles', frequency: 7, lastSeenAt: null },
    { category: 'prepositions', frequency: 5, lastSeenAt: null },
    { category: 'verb_tense', frequency: 3, lastSeenAt: null },
    { category: 'word_order', frequency: 2, lastSeenAt: null },
    { category: 'l1_calque', frequency: 1, lastSeenAt: null },
  ],
  vocabulary: { new: 12, partial: 5, passive: 3, active: 1 },
};

export const EMPTY_SESSIONS_ROUTE = {
  'GET /api/sessions': jsonResponse([]),
};

export const EMPTY_LEARNER_MODEL: LearnerModel = {
  weakAreas: [],
  vocabulary: { new: 0, partial: 0, passive: 0, active: 0 },
};

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
