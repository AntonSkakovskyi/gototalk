import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RequestValidationError, ZodBodyPipe } from './zod-body.pipe.js';

const schema = z.object({
  email: z.string().trim().toLowerCase(),
  age: z.number().int(),
});

describe('ZodBodyPipe', () => {
  it('[TC-01-02] returns the parsed value, applying schema transforms', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(
      pipe.transform({ email: ' A@B.com ', age: 3, extra: 'dropped' }),
    ).toEqual({ email: 'a@b.com', age: 3 });
  });

  it('[TC-01-02] throws RequestValidationError for an invalid body', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(() => pipe.transform({ email: 'a@b.com', age: 'x' })).toThrow(
      RequestValidationError,
    );
  });

  it('[TC-01-02] throws RequestValidationError for a missing body', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(() => pipe.transform(undefined)).toThrow(RequestValidationError);
  });

  it('[TC-00-07] the error carries the issues of the failed parse', () => {
    const pipe = new ZodBodyPipe(schema);

    try {
      pipe.transform({ email: 'a@b.com', age: 'x' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RequestValidationError);
      const { issues } = error as RequestValidationError;
      expect(issues.map((issue) => issue.path)).toEqual([['age']]);
    }
  });
});
