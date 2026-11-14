import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RequestValidationError } from './zod-body.pipe.js';
import { ZodQueryPipe } from './zod-query.pipe.js';

const pipe = new ZodQueryPipe(
  z.object({
    limit: z
      .string()
      .regex(/^[0-9]+$/)
      .transform(Number)
      .default(5),
  }),
);

describe('ZodQueryPipe', () => {
  it('[TC-05-03] parses string query values and applies defaults', () => {
    expect(pipe.transform({ limit: '7' })).toEqual({ limit: 7 });
    expect(pipe.transform({})).toEqual({ limit: 5 });
  });

  it('[TC-05-03] throws RequestValidationError for an invalid query', () => {
    expect(() => pipe.transform({ limit: 'abc' })).toThrow(
      RequestValidationError,
    );
  });
});
