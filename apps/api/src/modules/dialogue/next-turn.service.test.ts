import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeLanguageModel } from '../../integrations/language-model/fake/fake-language-model.js';
import {
  LanguageModelInvalidResponseError,
  LanguageModelUnavailableError,
} from '../../integrations/language-model/language-model.errors.js';
import type {
  LanguageModelPort,
  NextTurnInput,
} from '../../integrations/language-model/language-model.port.js';
import { NextTurnService } from './next-turn.service.js';

const SENTINEL = 'SENTINEL-user-text-do-not-log';
const INPUT: NextTurnInput = {
  topic: 'Work',
  remainingQuestions: ['What do you do?', 'Where do you work?'],
  history: [{ role: 'assistant', text: 'Hello' }],
};

function serviceWith(model: Pick<LanguageModelPort, 'nextTurn'>) {
  return new NextTurnService(model as LanguageModelPort);
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

describe('NextTurnService.nextTurn', () => {
  it('[TC-04-01] returns a valid model turn', async () => {
    const nextTurn = vi.fn().mockResolvedValue({ question: 'Why?' });

    await expect(serviceWith({ nextTurn }).nextTurn(INPUT)).resolves.toEqual({
      question: 'Why?',
    });
    expect(nextTurn).toHaveBeenCalledWith(INPUT);
  });

  it('[TC-04-08] retries once after an invalid response and logs one warning without user text', async () => {
    const nextTurn = vi
      .fn()
      .mockResolvedValueOnce({ question: 5, note: SENTINEL })
      .mockResolvedValueOnce({ question: 'Why?' });
    const warn = silenceWarnings();

    await expect(serviceWith({ nextTurn }).nextTurn(INPUT)).resolves.toEqual({
      question: 'Why?',
    });

    expect(nextTurn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-04-08] throws LanguageModelInvalidResponseError after two invalid responses', async () => {
    const nextTurn = vi.fn().mockResolvedValue({ question: '' });
    silenceWarnings();

    const error = await failureOf(serviceWith({ nextTurn }).nextTurn(INPUT));

    expect(error).toBeInstanceOf(LanguageModelInvalidResponseError);
    expect(nextTurn).toHaveBeenCalledTimes(2);
  });

  it('[TC-04-08] propagates LanguageModelUnavailableError without a retry', async () => {
    const unavailable = new LanguageModelUnavailableError();
    const nextTurn = vi.fn().mockRejectedValue(unavailable);

    const error = await failureOf(serviceWith({ nextTurn }).nextTurn(INPUT));

    expect(error).toBe(unavailable);
    expect(nextTurn).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-08] propagates other errors untouched', async () => {
    const outage = new Error('provider is down');
    const nextTurn = vi.fn().mockRejectedValue(outage);

    await expect(serviceWith({ nextTurn }).nextTurn(INPUT)).rejects.toBe(
      outage,
    );
  });

  it('[TC-04-01] works with the Fake model: the first remaining question comes next', async () => {
    const service = serviceWith(new FakeLanguageModel());

    await expect(service.nextTurn(INPUT)).resolves.toEqual({
      question: 'What do you do?',
    });
  });

  it('[TC-04-01] works with the Fake model: exhausted questions give a follow-up on the last answer', async () => {
    const service = serviceWith(new FakeLanguageModel());

    const turn = await service.nextTurn({
      topic: 'Work',
      remainingQuestions: [],
      history: [
        { role: 'assistant', text: 'What do you do?' },
        { role: 'user', text: 'I build bridges' },
      ],
    });

    expect(turn.question).toContain('bridges');
  });

  it('[TC-04-08] the Fake invalid_json mode breaks analysis only, not the next turn', async () => {
    const service = serviceWith(
      new FakeLanguageModel({ failMode: 'invalid_json' }),
    );

    await expect(service.nextTurn(INPUT)).resolves.toEqual({
      question: 'What do you do?',
    });
  });
});
