import { ZodBodyPipe } from './zod-body.pipe.js';
import type { z } from 'zod';

export class ZodQueryPipe<S extends z.ZodType> extends ZodBodyPipe<S> {}
