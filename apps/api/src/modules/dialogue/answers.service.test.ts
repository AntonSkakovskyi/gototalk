import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import type { Utterance } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { AnswersService } from './answers.service.js';
import {
  AnswerNotExpectedError,
  SessionFinishedError,
  SessionNotFoundError,
} from './dialogue.errors.js';
import type { DialogueRepository } from './persistence/dialogue.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const ANSWER = { verbatim: 'I very like it', clean: 'I very like it' };
const UTTERANCE: Utterance = {
  id: '44444444-4444-4444-8444-444444444444',
  seq: 2,
  role: 'user',
  text: ANSWER.verbatim,
  analysisStatus: 'pending',
  mistakes: [],
  better: [],
};

function setup(submitAnswer: unknown) {
  const repository = { submitAnswer };
  return new AnswersService(repository as unknown as DialogueRepository);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('AnswersService.submit', () => {
  it('[TC-04-03] returns the stored utterance and passes the answer to the repository', async () => {
    const submitAnswer = vi.fn().mockResolvedValue(UTTERANCE);

    await expect(
      setup(submitAnswer).submit(USER_ID, SESSION_ID, ANSWER),
    ).resolves.toEqual(UTTERANCE);
    expect(submitAnswer).toHaveBeenCalledWith(USER_ID, SESSION_ID, ANSWER);
  });

  it('[TC-04-03] answers 404 SESSION_NOT_FOUND for a non-uuid id without touching the repository', async () => {
    const submitAnswer = vi.fn();

    const error = await rejection(
      setup(submitAnswer).submit(USER_ID, 'not-a-uuid', ANSWER),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it.each([
    [new SessionNotFoundError(), NotFoundException, 'SESSION_NOT_FOUND'],
    [new SessionFinishedError(), ConflictException, 'SESSION_FINISHED'],
    [new AnswerNotExpectedError(), ConflictException, 'ANSWER_NOT_EXPECTED'],
  ])('[TC-04-03] maps %s to %s with code %s', async (domain, type, code) => {
    const error = await rejection(
      setup(vi.fn().mockRejectedValue(domain)).submit(
        USER_ID,
        SESSION_ID,
        ANSWER,
      ),
    );

    expect(error).toBeInstanceOf(type);
    const body = (error as NotFoundException | ConflictException).getResponse();
    expect(body).toMatchObject({ code });
    expect(JSON.stringify(body)).not.toContain(ANSWER.verbatim);
  });

  it('[TC-04-03] rethrows unknown errors unchanged', async () => {
    const failure = new Error('db down');

    await expect(
      setup(vi.fn().mockRejectedValue(failure)).submit(
        USER_ID,
        SESSION_ID,
        ANSWER,
      ),
    ).rejects.toBe(failure);
  });
});
