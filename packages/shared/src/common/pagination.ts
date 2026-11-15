import { z } from 'zod';

export const PAGE_SIZE_DEFAULT = 20;

export const PAGE_SIZE_MAX = 50;

// Query values arrive as strings, so the limit accepts digits only
const PageLimitSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(z.int().min(1).max(PAGE_SIZE_MAX));

export const PageQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: PageLimitSchema.default(PAGE_SIZE_DEFAULT),
});

export type PageQuery = z.infer<typeof PageQuerySchema>;
