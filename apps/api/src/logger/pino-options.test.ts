import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { buildPinoHttpOptions } from './pino-options.js';

describe('buildPinoHttpOptions', () => {
  it('[TC-00-04] redact приховує authorization і cookie запиту', () => {
    const options = buildPinoHttpOptions({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    });

    expect(options.redact).toMatchObject({
      paths: expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
      ]),
    });

    // Перевірка на справжньому pino, що ці шляхи справді замасковано
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const logger = pino(
      { redact: options.redact as pino.redactOptions },
      stream,
    );
    logger.info({
      req: {
        headers: { authorization: 'Bearer secret-token', cookie: 'sid=secret' },
      },
    });

    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('sid=secret');
    expect(output).toContain('[REDACTED]');
  });

  it('[TC-00-04] рівень логів береться з LOG_LEVEL', () => {
    expect(
      buildPinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }).level,
    ).toBe('warn');
  });

  it('[TC-00-04] pino-pretty підключається поза production', () => {
    for (const nodeEnv of ['development', 'test'] as const) {
      expect(
        buildPinoHttpOptions({ NODE_ENV: nodeEnv, LOG_LEVEL: 'info' })
          .transport,
      ).toMatchObject({ target: 'pino-pretty' });
    }
  });

  it('[TC-00-04] у production лог лишається JSON без pino-pretty', () => {
    expect(
      buildPinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' })
        .transport,
    ).toBeUndefined();
  });
});
