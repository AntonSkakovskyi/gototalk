import { loadPrompt } from './prompt-loader.js';
import type { PlanSessionInput } from './language-model.port.js';

const PROMPT_ID = 'session-plan.v1';
const INPUT_PLACEHOLDER = '{{input}}';

function fillInputPlaceholder(template: string, data: string): string {
  if (template.split(INPUT_PLACEHOLDER).length !== 2) {
    throw new Error(
      `Prompt template must contain exactly one ${INPUT_PLACEHOLDER} placeholder`,
    );
  }
  return template.replace(INPUT_PLACEHOLDER, () => data);
}

export function renderSessionPlanPrompt(input: PlanSessionInput): {
  id: typeof PROMPT_ID;
  text: string;
} {
  return {
    id: PROMPT_ID,
    text: fillInputPlaceholder(loadPrompt(PROMPT_ID), JSON.stringify(input)),
  };
}
