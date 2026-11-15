import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export class RequestValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
}

export class ZodBodyPipe<S extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new RequestValidationError(result.error.issues);
    return result.data;
  }
}
