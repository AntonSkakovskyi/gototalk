import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export class ZodBodyPipe<S extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    return this.schema.parse(value);
  }
}
