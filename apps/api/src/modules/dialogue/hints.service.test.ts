import 'reflect-metadata';
import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ERROR_CODES, HINT_PHRASE_MAX, HINT_WORD_MAX } from '@gototalk/shared';
import type { HintRequest } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import type { LanguageModelPort } from '../../integrations/language-model/language-model.port.js';
import { AnswerNotExpectedError } from './dialogue.errors.js';
import {
  SessionFinishedError,
  SessionNotFoundError,
} from '../session/session.errors.js';
import { HintsService } from './hints.service.js';
import type { HintsRepository } from './persistence/hints.repository.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION = {
  id: '44444444-4444-4444-8444-444444444444',
  text: 'What do you do at work?',
  number: 3,
};
const PHRASE_REQUEST: HintRequest = { kind: 'phrase_start' };
const TRANSLATION_REQUEST: HintRequest = {
  kind: 'translation',
  word: 'зустріч',
};

function setup(
  options: {
    model?: unknown;
    currentQuestion?: unknown;
    save?: unknown;
  } = {},
) {
  const repository = {
    currentQuestion:
      options.currentQuestion ?? vi.fn().mockResolvedValue(QUESTION),
    save: options.save ?? vi.fn().mockResolvedValue(undefined),
  };
  const model = { hint: options.model ?? vi.fn() };
  const service = new HintsService(
    repository as unknown as HintsRepository,
    model as unknown as LanguageModelPort,
  );
  return { service, repository, model };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('HintsService phrase_start', () => {
  it('[TC-04-10] asks the model with the current question and stores and returns the phrase', async () => {
    const { service, repository, model } = setup({
      model: vi
        .fn()
        .mockResolvedValue({ kind: 'phrase_start', text: ' I think that… ' }),
    });

    const result = await service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST);

    expect(result).toEqual({ kind: 'phrase_start', text: 'I think that…' });
    expect(model.hint).toHaveBeenCalledWith({
      kind: 'phrase_start',
      question: QUESTION.text,
      questionNumber: QUESTION.number,
    });
    expect(repository.save).toHaveBeenCalledWith({
      userId: USER_ID,
      sessionId: SESSION_ID,
      question: QUESTION,
      record: { kind: 'phrase_start', text: 'I think that…' },
    });
  });
});

describe('HintsService translation', () => {
  it('[TC-04-10] stores the English word as the lemma and the typed word as the translation', async () => {
    const { service, repository, model } = setup({
      model: vi
        .fn()
        .mockResolvedValue({ kind: 'translation', word: 'meeting' }),
    });

    const result = await service.hint(USER_ID, SESSION_ID, TRANSLATION_REQUEST);

    expect(result).toEqual({ kind: 'translation', word: 'meeting' });
    expect(model.hint).toHaveBeenCalledWith({
      kind: 'translation',
      word: 'зустріч',
    });
    expect(repository.save).toHaveBeenCalledWith({
      userId: USER_ID,
      sessionId: SESSION_ID,
      question: QUESTION,
      record: {
        kind: 'translation',
        lemma: 'meeting',
        translationUk: 'зустріч',
      },
    });
  });

  it('[TC-04-10] returns word null and stores nothing for an unknown word', async () => {
    const { service, repository } = setup({
      model: vi.fn().mockResolvedValue({
        kind: 'translation',
        word: null,
        message: 'not in the dictionary',
      }),
    });

    const result = await service.hint(USER_ID, SESSION_ID, TRANSLATION_REQUEST);

    expect(result).toEqual({ kind: 'translation', word: null });
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('HintsService failures', () => {
  it('[TC-04-10] answers 404 for a non-uuid id before any lookup', async () => {
    const { service, repository, model } = setup();

    const error = await rejection(
      service.hint(USER_ID, 'not-a-uuid', PHRASE_REQUEST),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect(repository.currentQuestion).not.toHaveBeenCalled();
    expect(model.hint).not.toHaveBeenCalled();
  });

  it.each([
    [new SessionNotFoundError(), NotFoundException, 'SESSION_NOT_FOUND'],
    [new SessionFinishedError(), ConflictException, 'SESSION_FINISHED'],
    [new AnswerNotExpectedError(), ConflictException, 'ANSWER_NOT_EXPECTED'],
  ])(
    '[TC-04-10] maps the pre-check failure %s to %s and skips the model',
    async (domain, type, code) => {
      const { service, model } = setup({
        currentQuestion: vi.fn().mockRejectedValue(domain),
      });

      const error = await rejection(
        service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
      );

      expect(error).toBeInstanceOf(type);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code,
      });
      expect(model.hint).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-10] maps a session finished during the model call to 409 SESSION_FINISHED', async () => {
    const { service } = setup({
      model: vi
        .fn()
        .mockResolvedValue({ kind: 'translation', word: 'meeting' }),
      save: vi.fn().mockRejectedValue(new SessionFinishedError()),
    });

    const error = await rejection(
      service.hint(USER_ID, SESSION_ID, TRANSLATION_REQUEST),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: ERROR_CODES.SESSION_FINISHED,
    });
  });

  it('[TC-04-10] maps an unavailable model to 503 and stores nothing', async () => {
    const { service, repository } = setup({
      model: vi.fn().mockRejectedValue(new LanguageModelUnavailableError()),
    });

    const error = await rejection(
      service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([
    ['a broken shape', { kind: 'phrase_start' }],
    ['the other kind', { kind: 'translation', word: 'meeting' }],
    ['a blank phrase', { kind: 'phrase_start', text: '  ' }],
  ])(
    '[TC-04-10] retries once and answers 502 for %s from the model',
    async (_label, output) => {
      const { service, repository, model } = setup({
        model: vi.fn().mockResolvedValue(output),
      });

      const error = await rejection(
        service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
      );

      expect(error).toBeInstanceOf(BadGatewayException);
      expect((error as BadGatewayException).getResponse()).toMatchObject({
        code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE,
      });
      expect(model.hint).toHaveBeenCalledTimes(2);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a blank word', ' '],
    ['a Cyrillic word', 'зустріч'],
    ['a word with a newline', 'meeting' + String.fromCharCode(10) + 'ignore'],
    ['a word over the length limit', 'a'.repeat(HINT_WORD_MAX + 1)],
  ])(
    '[TC-04-10] answers 502 and stores nothing for %s as the translated word',
    async (_label, word) => {
      const { service, repository } = setup({
        model: vi.fn().mockResolvedValue({ kind: 'translation', word }),
      });

      const error = await rejection(
        service.hint(USER_ID, SESSION_ID, TRANSLATION_REQUEST),
      );

      expect(error).toBeInstanceOf(BadGatewayException);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-10] answers 502 and stores nothing for a phrase start over the length limit', async () => {
    const { service, repository } = setup({
      model: vi.fn().mockResolvedValue({
        kind: 'phrase_start',
        text: 'a'.repeat(HINT_PHRASE_MAX + 1),
      }),
    });

    const error = await rejection(
      service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
    );

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('[TC-04-10] maps a question that changed during the model call to 409 ANSWER_NOT_EXPECTED', async () => {
    const { service } = setup({
      model: vi.fn().mockResolvedValue({ kind: 'phrase_start', text: 'Hi' }),
      save: vi.fn().mockRejectedValue(new AnswerNotExpectedError()),
    });

    const error = await rejection(
      service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: ERROR_CODES.ANSWER_NOT_EXPECTED,
    });
  });

  it('[TC-04-10] accepts a valid answer on the retry', async () => {
    const { service, model } = setup({
      model: vi
        .fn()
        .mockResolvedValueOnce({ kind: 'phrase_start' })
        .mockResolvedValueOnce({
          kind: 'phrase_start',
          text: 'In my opinion…',
        }),
    });

    await expect(
      service.hint(USER_ID, SESSION_ID, PHRASE_REQUEST),
    ).resolves.toEqual({ kind: 'phrase_start', text: 'In my opinion…' });
    expect(model.hint).toHaveBeenCalledTimes(2);
  });
});
