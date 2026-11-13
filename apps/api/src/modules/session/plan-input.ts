import type { Goal, PlanSessionRequest, Profile } from '@gototalk/shared';
import type { PlanSessionInput } from '../../integrations/language-model/language-model.port.js';
import type { WeakArea } from '../profile/learner-model.types.js';

const MAX_PATTERNS = 3;

interface PlanInputSources {
  profile: Profile;
  goals: Goal[];
  weakAreas: WeakArea[];
  request: PlanSessionRequest;
}

/** `weakAreas` must be ordered most frequent first: the prompt relies on it. */
export function buildPlanInput({
  profile,
  goals,
  weakAreas,
  request,
}: PlanInputSources): PlanSessionInput {
  return {
    level: profile.level,
    scenes: profile.scenes,
    goals: goals.map(({ title }) => title),
    patterns: weakAreas.slice(0, MAX_PATTERNS).map(({ category }) => category),
    previousTopics:
      request.customTopic === undefined ? request.previousTopics : [],
    ...(request.customTopic === undefined
      ? {}
      : { customTopic: request.customTopic }),
  };
}
