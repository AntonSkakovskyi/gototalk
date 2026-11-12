import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { buildPinoHttpOptions } from './pino-options.js';

describe('buildPinoHttpOptions', () => {
  it('[TC-00-04] redact hides the request authorization and cookie', () => {
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

  it('[TC-00-04] redact hides the response set-cookie header', () => {
    const options = buildPinoHttpOptions({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    });

    expect(options.redact).toMatchObject({
      paths: expect.arrayContaining(['res.headers["set-cookie"]']),
    });

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
      res: {
        headers: { 'set-cookie': ['gtt_refresh=secret-refresh; HttpOnly'] },
      },
    });

    expect(output).not.toContain('secret-refresh');
    expect(output).toContain('[REDACTED]');
  });

  it('[TC-00-04] log level comes from LOG_LEVEL', () => {
    expect(
      buildPinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }).level,
    ).toBe('warn');
  });

  it('[TC-00-04] pino-pretty is enabled outside production', () => {
    for (const nodeEnv of ['development', 'test'] as const) {
      expect(
        buildPinoHttpOptions({ NODE_ENV: nodeEnv, LOG_LEVEL: 'info' })
          .transport,
      ).toMatchObject({ target: 'pino-pretty' });
    }
  });

  it('[TC-00-04] in production the log stays JSON without pino-pretty', () => {
    expect(
      buildPinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' })
        .transport,
    ).toBeUndefined();
  });
});
