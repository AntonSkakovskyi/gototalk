import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DONE,
  SENTINEL,
  SESSION_ID,
  TARGET_ID,
  USER_ID,
  answer,
  reply,
  question,
  run,
  setup,
  state,
  view,
} from './testing/turn-service-fixtures.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TurnService.run', () => {
  it('[TC-04-02] analyses the answer, asks the next question and returns the stored result', async () => {
    const { service, analyze, nextTurn, persist } = setup();

    const result = await run(service);

    expect(analyze).toHaveBeenCalledWith(SENTINEL);
    expect(nextTurn).toHaveBeenCalledWith({
      topic: 'Work',
      remainingQuestions: ['q2', 'q3'],
      history: [
        { role: 'assistant', text: 'q1' },
        { role: 'user', text: 'cleaned answer' },
      ],
    });
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: DONE,
      reply: 'q2',
    });
    expect(result).toEqual({
      utterance: view(TARGET_ID, 2),
      reply: view(reply.id, 3),
      planRemaining: 1,
    });
  });

  it('[TC-04-02] makes no model call and writes nothing when everything is stored', async () => {
    const stored = { ...answer, analysisStatus: 'done' as const };
    const { service, analyze, nextTurn, persist } = setup(
      state({ utterances: [question, stored, reply], target: stored }),
    );

    await expect(run(service)).resolves.toMatchObject({ planRemaining: 1 });

    expect(analyze).not.toHaveBeenCalled();
    expect(nextTurn).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('[TC-04-02] skips the analysis call when only the reply is missing', async () => {
    const failed = { ...answer, analysisStatus: 'failed' as const };
    const { service, analyze, nextTurn, persist } = setup(
      state({ utterances: [question, failed], target: failed }),
    );

    await run(service);

    expect(analyze).not.toHaveBeenCalled();
    expect(nextTurn).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, failed, {
      analysis: null,
      reply: 'q2',
    });
  });

  it('[TC-04-02] does not ask for a reply in a finished session but still analyses', async () => {
    const { service, analyze, nextTurn, persist } = setup(
      state({ sessionActive: false }),
    );

    await run(service);

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(nextTurn).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: DONE,
      reply: null,
    });
  });
});
