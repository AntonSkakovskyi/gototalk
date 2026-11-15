import { BetterPhrasingSchema } from '@gototalk/shared';
import { MistakeSchema } from '../model-output.js';
import { z } from 'zod';

export const AnalysisResultSchema = z.object({
  mistakes: z.array(MistakeSchema),
  better: z.array(BetterPhrasingSchema).max(2),
});
