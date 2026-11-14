import {
  testMistake,
  testSession,
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import {
  findUnansweredUtteranceId,
  withMistake,
  withSession,
  withTurnResult,
  withUtterance,
} from './details-cache';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const TURN = testTurnResult();
const REPLY = testUtterance({
  id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0003',
  seq: 3,
});
const PENDING = {
  ...TURN.utterance,
  analysisStatus: 'pending' as const,
  mistakes: [],
};

function detailsWith(...utterances: ReturnType<typeof testUtterance>[]) {
  return deepFreeze(
    testSessionDetails({ utterances: [testUtterance(), ...utterances] }),
  );
}

describe('details-cache', () => {
  describe('withUtterance', () => {
    it('[TC-04-04] appends a new utterance without mutating the input', () => {
      const details = detailsWith();

      const next = withUtterance(details, PENDING);

      expect(next).not.toBe(details);
      expect(next.utterances.map((item) => item.id)).toEqual([
        testUtterance().id,
        PENDING.id,
      ]);
      expect(details.utterances).toHaveLength(1);
    });

    it('[TC-04-04] keeps the stored utterance when the id already exists', () => {
      const details = detailsWith(TURN.utterance);

      const next = withUtterance(details, PENDING);

      expect(next.utterances).toHaveLength(2);
      expect(next.utterances[1]).toEqual(TURN.utterance);
    });

    it('[TC-04-04] orders utterances by seq', () => {
      const late = testUtterance({
        id: '9e4a1c73-6b2d-4f8a-a1c5-3b7d5e8f0009',
        seq: 5,
      });
      const details = detailsWith(late);

      const next = withUtterance(details, PENDING);

      expect(next.utterances.map((item) => item.seq)).toEqual([1, 2, 5]);
    });
  });

  describe('withTurnResult', () => {
    it('[TC-04-04] replaces the answered utterance, adds the reply and sets planRemaining', () => {
      const details = detailsWith(PENDING);

      const next = withTurnResult(details, TURN);

      expect(next.utterances.map((item) => item.id)).toEqual([
        testUtterance().id,
        TURN.utterance.id,
        REPLY.id,
      ]);
      expect(next.utterances[1]).toEqual(TURN.utterance);
      expect(next.planRemaining).toBe(TURN.planRemaining);
      expect(details.utterances[1]).toEqual(PENDING);
    });

    it('[TC-04-04] does not duplicate a reply that is already stored', () => {
      const next = withTurnResult(detailsWith(PENDING, REPLY), TURN);

      expect(next.utterances).toHaveLength(3);
    });

    it('[TC-04-04] adds no reply when the result has none', () => {
      const next = withTurnResult(detailsWith(PENDING), {
        ...TURN,
        reply: null,
        planRemaining: 0,
      });

      expect(next.utterances).toHaveLength(2);
      expect(next.planRemaining).toBe(0);
    });

    it('[TC-04-04] appends the answered utterance when it is missing', () => {
      const next = withTurnResult(detailsWith(), TURN);

      expect(next.utterances.map((item) => item.id)).toEqual([
        testUtterance().id,
        TURN.utterance.id,
        REPLY.id,
      ]);
    });
  });

  describe('withMistake', () => {
    it('[TC-04-04] replaces the mistake with the same id and leaves the others', () => {
      const other = testMistake({
        id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0002',
        start: 10,
        end: 12,
      });
      const answered = { ...TURN.utterance, mistakes: [testMistake(), other] };
      const details = detailsWith(answered);

      const next = withMistake(details, testMistake({ isFalse: true }));

      expect(next.utterances[1]?.mistakes).toEqual([
        testMistake({ isFalse: true }),
        other,
      ]);
      expect(details.utterances[1]?.mistakes[0]?.isFalse).toBe(false);
    });

    it('[TC-04-04] leaves the content equal when no utterance has that mistake', () => {
      const details = detailsWith();

      expect(withMistake(details, testMistake())).toEqual(details);
    });

    it('[TC-04-04] returns the same details when the mistake id is not found', () => {
      const details = detailsWith(TURN.utterance);
      const unknown = testMistake({
        id: '3f6b2d18-9c4e-4a7b-b2d0-5e8a1c7f0099',
      });

      expect(withMistake(details, unknown)).toBe(details);
    });

    it('[TC-04-04] keeps the references of utterances without that mistake', () => {
      const answered = { ...TURN.utterance, mistakes: [testMistake()] };
      const details = detailsWith(answered, REPLY);

      const next = withMistake(details, testMistake({ isFalse: true }));

      expect(next).not.toBe(details);
      expect(next.utterances[0]).toBe(details.utterances[0]);
      expect(next.utterances[1]).not.toBe(details.utterances[1]);
      expect(next.utterances[2]).toBe(details.utterances[2]);
    });
  });

  describe('withSession', () => {
    it('[TC-04-04] replaces session fields and keeps utterances and planRemaining', () => {
      const details = detailsWith(TURN.utterance);
      const finished = testSession({
        status: 'finished',
        endedAt: '2026-11-13T10:30:00.000Z',
      });

      const next = withSession(details, finished);

      expect(next).not.toBe(details);
      expect(next).toMatchObject(finished);
      expect(next.utterances).toEqual(details.utterances);
      expect(next.planRemaining).toBe(details.planRemaining);
      expect(details.status).toBe('active');
    });
  });

  describe('findUnansweredUtteranceId', () => {
    it('[TC-04-08] finds a last user utterance', () => {
      expect(findUnansweredUtteranceId(detailsWith(PENDING))).toBe(PENDING.id);
    });

    it('[TC-04-08] finds a pending user utterance that already has a reply', () => {
      expect(findUnansweredUtteranceId(detailsWith(PENDING, REPLY))).toBe(
        PENDING.id,
      );
    });

    it('[TC-04-08] finds nothing when the last answer is analysed and replied to', () => {
      expect(
        findUnansweredUtteranceId(detailsWith(TURN.utterance, REPLY)),
      ).toBeUndefined();
    });

    it('[TC-04-08] finds nothing when only the question is there', () => {
      expect(findUnansweredUtteranceId(detailsWith())).toBeUndefined();
    });

    it('[TC-04-08] finds nothing for a finished session', () => {
      const details = deepFreeze({
        ...testSessionDetails({ utterances: [testUtterance(), PENDING] }),
        status: 'finished' as const,
        endedAt: '2026-11-13T10:30:00.000Z',
      });

      expect(findUnansweredUtteranceId(details)).toBeUndefined();
    });
  });
});
