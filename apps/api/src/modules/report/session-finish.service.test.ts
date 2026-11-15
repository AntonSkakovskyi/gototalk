import 'reflect-metadata';
import { Logger, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReportGeneratorService } from './report-generator.service.js';
import { SessionsService } from '../session/sessions.service.js';
import { SessionFinishService } from './session-finish.service.js';

type SessionsRepository = ConstructorParameters<typeof SessionsService>[0];

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const SESSION = {
  id: SESSION_ID,
  topic: 'Weekend plans',
  topicSource: 'suggested',
  feedbackMode: 'deferred',
  status: 'finished',
  startedAt: '2026-11-13T10:00:00.000Z',
  endedAt: '2026-11-13T10:05:00.000Z',
};
const READY = { status: 'ready', text: 'summary' };

afterEach(() => {
  vi.restoreAllMocks();
});

function setupFinish(
  finish: unknown,
  ensure: unknown = vi.fn().mockResolvedValue(READY),
): SessionFinishService {
  return new SessionFinishService(
    new SessionsService({ finish } as unknown as SessionsRepository),
    { ensure } as unknown as ReportGeneratorService,
  );
}

describe('SessionFinishService.finish', () => {
  it('[TC-05-02] generates the report after the session is finished', async () => {
    const order: string[] = [];
    const finish = vi.fn().mockImplementation(() => {
      order.push('finish');
      return Promise.resolve(SESSION);
    });
    const ensure = vi.fn().mockImplementation(() => {
      order.push('ensure');
      return Promise.resolve(READY);
    });

    await setupFinish(finish, ensure).finish(USER_ID, SESSION_ID);

    expect(ensure).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(order).toEqual(['finish', 'ensure']);
  });

  it('[TC-05-02] does not generate a report for a missing session or a malformed id', async () => {
    const ensure = vi.fn();

    await expect(
      setupFinish(vi.fn().mockResolvedValue(null), ensure).finish(
        USER_ID,
        SESSION_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      setupFinish(vi.fn(), ensure).finish(USER_ID, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('[TC-05-02] still returns the session and logs only the error name when report generation fails', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const ensure = vi
      .fn()
      .mockRejectedValue(new TypeError('learner text: I go to office'));

    await expect(
      setupFinish(vi.fn().mockResolvedValue(SESSION), ensure).finish(
        USER_ID,
        SESSION_ID,
      ),
    ).resolves.toEqual(SESSION);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('learner text');
    expect(warn).toHaveBeenCalledWith(
      'Report generation failed on finish: TypeError',
    );
  });
});
