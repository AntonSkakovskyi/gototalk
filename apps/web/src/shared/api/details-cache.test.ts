import {
  testMistake,
  testSessionDetails,
  testTurnResult,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import { withMistake } from './details-cache';

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

function detailsWith(...utterances: ReturnType<typeof testUtterance>[]) {
  return deepFreeze(
    testSessionDetails({ utterances: [testUtterance(), ...utterances] }),
  );
}

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
