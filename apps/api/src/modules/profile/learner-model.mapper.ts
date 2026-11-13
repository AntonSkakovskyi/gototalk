import type { LearnerModel } from '@gototalk/shared';
import type { LearnerModelSnapshot } from './learner-model.types.js';

export function toLearnerModel({
  weakAreas,
  vocabulary,
}: LearnerModelSnapshot): LearnerModel {
  return {
    weakAreas: weakAreas.map((area) => ({
      category: area.category,
      frequency: area.frequency,
      lastSeenAt: area.lastSeenAt ? area.lastSeenAt.toISOString() : null,
    })),
    vocabulary,
  };
}
