import 'reflect-metadata';
import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ERROR_CODES } from '@gototalk/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LanguageModelInvalidResponseError,
  LanguageModelUnavailableError,
} from '../../integrations/language-model/language-model.errors.js';
import type { AnalysisOutcome } from '../analysis/mistake-analyzer.types.js';
import { UtteranceNotFoundError } from './dialogue.errors.js';
import { SessionNotFoundError } from '../session/session.errors.js';
import {
  DONE,
  SESSION_ID,
  TARGET_ID,
  USER_ID,
  answer,
  rejection,
  run,
  setup,
  silenceWarnings,
} from './testing/turn-service-fixtures.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TurnService.run errors', () => {
  it('[TC-04-08] persists the reply and answers 503 when the analysis is unavailable', async () => {
    const warn = silenceWarnings();
    const { service, analyze, persist, findDetails } = setup();
    analyze.mockRejectedValue(new LanguageModelUnavailableError());

    const error = await rejection(run(service));

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error).toMatchObject({
      response: { code: ERROR_CODES.LANGUAGE_MODEL_UNAVAILABLE },
    });
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: null,
      reply: 'q2',
    });
    expect(warn).toHaveBeenCalledWith('Language model unavailable');
    expect(findDetails).not.toHaveBeenCalled();
  });

  it('[TC-04-08] persists the analysis and answers 502 when the next turn is invalid', async () => {
    const { service, nextTurn, persist } = setup();
    nextTurn.mockRejectedValue(new LanguageModelInvalidResponseError());

    const error = await rejection(run(service));

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error).toMatchObject({
      response: { code: ERROR_CODES.LANGUAGE_MODEL_INVALID_RESPONSE },
    });
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: DONE,
      reply: null,
    });
  });

  it('[TC-04-08] prefers 503 over 502 when both calls fail and writes nothing', async () => {
    const warn = silenceWarnings();
    const { service, analyze, nextTurn, persist } = setup();
    analyze.mockRejectedValue(new LanguageModelUnavailableError());
    nextTurn.mockRejectedValue(new LanguageModelInvalidResponseError());

    expect(await rejection(run(service))).toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(persist).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-08] rethrows an unknown error untouched after persisting what succeeded', async () => {
    const outage = new Error('provider is down');
    const { service, nextTurn, persist } = setup();
    nextTurn.mockRejectedValue(outage);

    expect(await rejection(run(service))).toBe(outage);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('[TC-04-08] still fails after persisting what succeeded when a call rejects with no reason', async () => {
    const { service, nextTurn, persist } = setup();
    nextTurn.mockRejectedValue(undefined);

    await expect(run(service)).rejects.toBeUndefined();
    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: DONE,
      reply: null,
    });
  });

  it('[TC-04-02] stores a failed analysis outcome', async () => {
    const failed: AnalysisOutcome = {
      status: 'failed',
      promptVersion: 'error-analysis.v1',
      model: 'fake',
    };
    const { service, analyze, persist } = setup();
    analyze.mockResolvedValue(failed);

    await run(service);

    expect(persist).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer, {
      analysis: failed,
      reply: 'q2',
    });
  });

  it.each(['not-a-uuid', ''])(
    '[TC-04-03] answers 404 SESSION_NOT_FOUND for the session id %j without a query',
    async (sessionId) => {
      const { service, loadState } = setup();

      const error = await rejection(service.run(USER_ID, sessionId, TARGET_ID));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error).toMatchObject({
        response: { code: ERROR_CODES.SESSION_NOT_FOUND },
      });
      expect(loadState).not.toHaveBeenCalled();
    },
  );

  it('[TC-04-03] answers 404 UTTERANCE_NOT_FOUND for a non-uuid utterance id', async () => {
    const { service, loadState } = setup();

    const error = await rejection(service.run(USER_ID, SESSION_ID, 'nope'));

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error).toMatchObject({
      response: { code: ERROR_CODES.UTTERANCE_NOT_FOUND },
    });
    expect(loadState).not.toHaveBeenCalled();
  });

  it.each([
    [new SessionNotFoundError(), ERROR_CODES.SESSION_NOT_FOUND],
    [new UtteranceNotFoundError(), ERROR_CODES.UTTERANCE_NOT_FOUND],
  ])('[TC-04-03] maps %s to a 404', async (failure, code) => {
    const { service, loadState } = setup();
    loadState.mockRejectedValue(failure);

    const error = await rejection(run(service));

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error).toMatchObject({ response: { code } });
  });

  it('[TC-04-03] answers 404 when the session disappears before the result is read', async () => {
    const { service, findDetails } = setup();
    findDetails.mockResolvedValue(null);

    expect(await rejection(run(service))).toBeInstanceOf(NotFoundException);
  });
});
