import { BetterPhrasingSchema, MistakeSchema } from '@gototalk/shared';
import { z } from 'zod';

export const AnalysisResultSchema = z.object({
  mistakes: z.array(MistakeSchema),
  better: z.array(BetterPhrasingSchema).max(2),
});
