import { describe, expect, it } from 'vitest';
import {
  NEXT_TURN_HISTORY_LIMIT,
  buildNextTurnInput,
} from './build-next-turn-input.js';

const utterance = (seq: number, role: 'assistant' | 'user', text: string) => ({
  seq,
  role,
  text,
});

describe('buildNextTurnInput', () => {
  it('[TC-04-01] drops plan questions already asked by the assistant', () => {
    const input = buildNextTurnInput({
      topic: 'Work',
      planQuestions: ['q1', 'q2', 'q3'],
      utterances: [utterance(1, 'assistant', 'q1'), utterance(2, 'user', 'q2')],
    });

    expect(input.topic).toBe('Work');
    expect(input.remainingQuestions).toEqual(['q2', 'q3']);
  });

  it('[TC-04-01] maps utterances to history entries without seq', () => {
    const input = buildNextTurnInput({
      topic: 'Work',
      planQuestions: [],
      utterances: [utterance(1, 'assistant', 'q1'), utterance(2, 'user', 'a1')],
    });

    expect(input.history).toEqual([
      { role: 'assistant', text: 'q1' },
      { role: 'user', text: 'a1' },
    ]);
  });

  it('[TC-04-01] keeps only the last NEXT_TURN_HISTORY_LIMIT entries in history', () => {
    const utterances = Array.from({ length: 20 }, (_, index) =>
      utterance(
        index + 1,
        index % 2 === 0 ? 'assistant' : 'user',
        `t${index + 1}`,
      ),
    );

    const { history } = buildNextTurnInput({
      topic: 'Work',
      planQuestions: [],
      utterances,
    });

    expect(NEXT_TURN_HISTORY_LIMIT).toBe(12);
    expect(history).toHaveLength(NEXT_TURN_HISTORY_LIMIT);
    expect(history[0]?.text).toBe('t9');
    expect(history.at(-1)?.text).toBe('t20');
  });

  it('[TC-04-01] counts questions as asked even when they fall outside the history window', () => {
    const utterances = [
      utterance(1, 'assistant', 'q1'),
      ...Array.from({ length: 14 }, (_, index) =>
        utterance(index + 2, 'user', `a${index}`),
      ),
    ];

    const input = buildNextTurnInput({
      topic: 'Work',
      planQuestions: ['q1', 'q2'],
      utterances,
    });

    expect(input.remainingQuestions).toEqual(['q2']);
  });
});
