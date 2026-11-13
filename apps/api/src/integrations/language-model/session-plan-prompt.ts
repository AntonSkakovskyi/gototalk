import { renderPrompt } from './render-prompt.js';
import type { PlanSessionInput } from './language-model.port.js';

export const SESSION_PLAN_PROMPT_ID = 'session-plan.v1';

export function renderSessionPlanPrompt(input: PlanSessionInput): {
  id: typeof SESSION_PLAN_PROMPT_ID;
  text: string;
} {
  return {
    id: SESSION_PLAN_PROMPT_ID,
    text: renderPrompt(SESSION_PLAN_PROMPT_ID, input).text,
  };
}
