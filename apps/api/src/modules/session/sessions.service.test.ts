import 'reflect-metadata';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES, RECENT_SESSIONS_LIMIT } from '@gototalk/shared';
import type { SessionDetails, StartSessionRequest } from '@gototalk/shared';
import { describe, expect, it, vi } from 'vitest';
import { SessionOwnerMissingError } from './session.errors.js';
import type { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST: StartSessionRequest = {
  topic: 'Weekend plans',
  topicSource: 'suggested',
  questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
  feedbackMode: 'deferred',
};
const DETAILS: SessionDetails = {
  id: '33333333-3333-4333-8333-333333333333',
  topic: 'Weekend plans',
  topicSource: 'suggested',
  feedbackMode: 'deferred',
  status: 'active',
  startedAt: '2026-11-13T10:00:00.000Z',
  endedAt: null,
  utterances: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      seq: 1,
      role: 'assistant',
      text: 'q1',
      analysisStatus: 'skipped',
      mistakes: [],
      better: [],
    },
  ],
  planRemaining: 4,
};

function setup(start: unknown) {
  const repository = { start };
  return new SessionsService(repository as unknown as SessionsRepository);
}

describe('SessionsService.start', () => {
  it('[TC-03-02] returns the session details from the repository', async () => {
    const start = vi.fn().mockResolvedValue(DETAILS);

    await expect(setup(start).start(USER_ID, REQUEST)).resolves.toEqual(
      DETAILS,
    );
    expect(start).toHaveBeenCalledWith(USER_ID, REQUEST);
  });

  it('[TC-03-02] maps a missing owner to 401 Unauthorized', async () => {
    const start = vi.fn().mockRejectedValue(new SessionOwnerMissingError());

    await expect(setup(start).start(USER_ID, REQUEST)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('[TC-03-02] rethrows unexpected repository errors unchanged', async () => {
    const failure = new Error('connection lost');
    const start = vi.fn().mockRejectedValue(failure);

    await expect(setup(start).start(USER_ID, REQUEST)).rejects.toBe(failure);
  });
});

describe('SessionsService reads', () => {
  const SESSION_ID = DETAILS.id;
  const SESSION = {
    id: DETAILS.id,
    topic: DETAILS.topic,
    topicSource: DETAILS.topicSource,
    feedbackMode: DETAILS.feedbackMode,
    status: DETAILS.status,
    startedAt: DETAILS.startedAt,
    endedAt: DETAILS.endedAt,
  };

  function setupReads(repository: object) {
    return new SessionsService(repository as unknown as SessionsRepository);
  }

  it('[TC-03-02] lists the recent sessions with the shared limit', async () => {
    const listRecent = vi.fn().mockResolvedValue([SESSION]);

    await expect(setupReads({ listRecent }).list(USER_ID)).resolves.toEqual([
      SESSION,
    ]);
    expect(listRecent).toHaveBeenCalledWith(USER_ID, RECENT_SESSIONS_LIMIT);
  });

  it('[TC-03-02] returns the session details of the owner', async () => {
    const findDetails = vi.fn().mockResolvedValue(DETAILS);

    await expect(
      setupReads({ findDetails }).details(USER_ID, SESSION_ID),
    ).resolves.toEqual(DETAILS);
    expect(findDetails).toHaveBeenCalledWith(USER_ID, SESSION_ID);
  });

  it('[TC-03-02] maps a missing session to 404 SESSION_NOT_FOUND', async () => {
    const findDetails = vi.fn().mockResolvedValue(null);

    await expect(
      setupReads({ findDetails }).details(USER_ID, SESSION_ID),
    ).rejects.toMatchObject({
      response: { code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  });

  it('[TC-03-02] answers 404 for a non-uuid id without querying', async () => {
    const findDetails = vi.fn();

    await expect(
      setupReads({ findDetails }).details(USER_ID, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findDetails).not.toHaveBeenCalled();
  });
});

describe('SessionsService.finish', () => {
  const SESSION = {
    id: DETAILS.id,
    topic: DETAILS.topic,
    topicSource: DETAILS.topicSource,
    feedbackMode: DETAILS.feedbackMode,
    status: 'finished',
    startedAt: DETAILS.startedAt,
    endedAt: '2026-11-13T10:05:00.000Z',
  };

  function setupFinish(finish: unknown) {
    return new SessionsService({ finish } as unknown as SessionsRepository);
  }

  it('[TC-04-04] returns the finished session from the repository', async () => {
    const finish = vi.fn().mockResolvedValue(SESSION);

    await expect(
      setupFinish(finish).finish(USER_ID, DETAILS.id),
    ).resolves.toEqual(SESSION);
    expect(finish).toHaveBeenCalledWith(USER_ID, DETAILS.id);
  });

  it('[TC-04-04] maps a missing session to 404 SESSION_NOT_FOUND', async () => {
    const finish = vi.fn().mockResolvedValue(null);

    await expect(
      setupFinish(finish).finish(USER_ID, DETAILS.id),
    ).rejects.toMatchObject({
      response: { code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  });

  it('[TC-04-04] answers 404 for a non-uuid id without querying', async () => {
    const finish = vi.fn();

    await expect(
      setupFinish(finish).finish(USER_ID, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(finish).not.toHaveBeenCalled();
  });
});
