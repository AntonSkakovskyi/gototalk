import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageModelUnavailableError } from '../../integrations/language-model/language-model.errors.js';
import type { AnalysisOutcome } from './mistake-analyzer.types.js';
import { PendingAnalysisService } from './pending-analysis.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const SENTINEL = 'SENTINEL-user-text-do-not-log';
const DONE: AnalysisOutcome = {
  status: 'done',
  mistakes: [],
  better: [],
  promptVersion: 'error-analysis.v1',
  model: 'fake',
};
const FAILED: AnalysisOutcome = {
  status: 'failed',
  promptVersion: 'error-analysis.v1',
  model: 'fake',
};
const first = { id: 'u-1', text: `${SENTINEL} one` };
const second = { id: 'u-2', text: 'second answer' };

function setup(pending = [first, second]) {
  const findPending = vi.fn().mockResolvedValue(pending);
  const save = vi.fn().mockResolvedValue(true);
  const analyze = vi.fn().mockResolvedValue(DONE);
  const service = new PendingAnalysisService(
    { findPending, save },
    { analyze },
  );
  return { service, findPending, save, analyze };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PendingAnalysisService.complete', () => {
  it('[TC-05-02] analyses every pending utterance in order and reports that none is left', async () => {
    const { service, findPending, save, analyze } = setup();

    await expect(service.complete(USER_ID, SESSION_ID)).resolves.toBe(true);

    expect(findPending).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(analyze.mock.calls).toEqual([[first.text], [second.text]]);
    expect(save.mock.calls).toEqual([
      [USER_ID, SESSION_ID, 'u-1', DONE],
      [USER_ID, SESSION_ID, 'u-2', DONE],
    ]);
  });

  it('[TC-05-02] does not call the model when nothing is pending', async () => {
    const { service, analyze, save } = setup([]);

    await expect(service.complete(USER_ID, SESSION_ID)).resolves.toBe(true);

    expect(analyze).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('[TC-05-02] saves a failed outcome as it is and goes on', async () => {
    const { service, analyze, save } = setup();
    analyze.mockResolvedValueOnce(FAILED);

    await expect(service.complete(USER_ID, SESSION_ID)).resolves.toBe(true);

    expect(save.mock.calls.map((call) => call[3])).toEqual([FAILED, DONE]);
  });

  it('[TC-05-02] stops without throwing when the model is unavailable and leaves the rest untouched', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, analyze, save } = setup();
    analyze.mockResolvedValueOnce(DONE);
    analyze.mockRejectedValueOnce(new LanguageModelUnavailableError());

    await expect(service.complete(USER_ID, SESSION_ID)).resolves.toBe(false);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[2]).toBe('u-1');
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
  });

  it('[TC-05-02] stops and reports true when the session is gone before the result is stored', async () => {
    const { service, analyze, save } = setup();
    save.mockResolvedValueOnce(false);

    await expect(service.complete(USER_ID, SESSION_ID)).resolves.toBe(true);

    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('[TC-05-02] rethrows an unexpected analyzer error', async () => {
    const { service, analyze } = setup();
    analyze.mockRejectedValueOnce(new Error('boom'));

    await expect(service.complete(USER_ID, SESSION_ID)).rejects.toThrow('boom');
  });
});
