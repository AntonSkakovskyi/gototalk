import type { ArgumentsHost, LoggerService } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { expect, vi } from 'vitest';
import { AllExceptionsFilter } from '../all-exceptions.filter.js';

export function setup() {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: {
      reply,
      getRequestMethod: () => 'POST',
      getRequestUrl: () => '/api/things',
    },
  } as unknown as HttpAdapterHost;
  const logger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as LoggerService;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({ marker: 'response' }),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(adapterHost, logger);

  function run(exception: unknown): { status: number; body: unknown } {
    filter.catch(exception, host);
    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0] as [unknown, unknown, number];
    return { status, body };
  }

  return { run, logger, reply };
}
