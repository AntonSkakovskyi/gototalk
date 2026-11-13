import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LanguageModelUnavailableError } from './language-model.errors.js';
import {
  LanguageModelInvalidResponseError,
  requestValidated,
} from './validated-call.js';

const SENTINEL = 'SENTINEL-user-text-do-not-log';
const Schema = z.object({ topic: z.string().min(1), count: z.number() });
const VALID = { topic: 'Travel', count: 5 };

function setup() {
  const logger = { warn: vi.fn() };
  return { logger };
}

describe('requestValidated', () => {
  it('[TC-03-01] returns a valid response after a single call', async () => {
    const { logger } = setup();
    const call = vi.fn().mockResolvedValue(VALID);

    await expect(requestValidated(Schema, call, logger)).resolves.toEqual(
      VALID,
    );

    expect(call).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('[TC-03-01] retries once after an invalid response and returns the second one', async () => {
    const { logger } = setup();
    const call = vi
      .fn()
      .mockResolvedValueOnce({ topic: '', count: 'x' })
      .mockResolvedValueOnce(VALID);

    await expect(requestValidated(Schema, call, logger)).resolves.toEqual(
      VALID,
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('[TC-03-01] throws the coded error after two invalid responses without a third call', async () => {
    const { logger } = setup();
    const call = vi.fn().mockResolvedValue({ topic: 1 });

    await expect(requestValidated(Schema, call, logger)).rejects.toBeInstanceOf(
      LanguageModelInvalidResponseError,
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('[TC-03-01] logs only the attempt, issue paths and issue codes', async () => {
    const { logger } = setup();
    const call = vi.fn().mockResolvedValue({ topic: 7, count: SENTINEL });

    await requestValidated(Schema, call, logger).catch(() => undefined);

    const [first, second] = logger.warn.mock.calls as [object, string][];
    expect(first?.[0]).toEqual({
      attempt: 1,
      issues: [
        { path: 'topic', code: 'invalid_type' },
        { path: 'count', code: 'invalid_type' },
      ],
    });
    expect(second?.[0]).toMatchObject({ attempt: 2 });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-03-01] the thrown error carries no model output', async () => {
    const { logger } = setup();
    const call = vi.fn().mockResolvedValue({ topic: SENTINEL });

    const error: unknown = await requestValidated(Schema, call, logger).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(LanguageModelInvalidResponseError);
    const { message, stack } = error as Error;
    expect(message).not.toContain(SENTINEL);
    expect(stack).not.toContain(SENTINEL);
    expect(JSON.stringify(error)).not.toContain(SENTINEL);
  });

  it('[TC-03-01] a provider failure propagates untouched and is not retried', async () => {
    const { logger } = setup();
    const failure = new Error('provider down');
    const call = vi.fn().mockRejectedValue(failure);

    await expect(requestValidated(Schema, call, logger)).rejects.toBe(failure);

    expect(call).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('[TC-04-08] a LanguageModelUnavailableError propagates unchanged without a retry or a log', async () => {
    const { logger } = setup();
    const failure = new LanguageModelUnavailableError();
    const call = vi.fn().mockRejectedValue(failure);

    await expect(requestValidated(Schema, call, logger)).rejects.toBe(failure);

    expect(call).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('[TC-03-01] a root-level mismatch is logged with an empty path', async () => {
    const { logger } = setup();
    const call = vi.fn().mockResolvedValue(SENTINEL);

    await requestValidated(Schema, call, logger).catch(() => undefined);

    expect(logger.warn.mock.calls[0]?.[0]).toEqual({
      attempt: 1,
      issues: [{ path: '', code: 'invalid_type' }],
    });
  });
});
