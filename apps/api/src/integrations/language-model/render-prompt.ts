import { loadPrompt } from './prompt-loader.js';

const INPUT_PLACEHOLDER = '{{input}}';

function fillInputPlaceholder(template: string, data: string): string {
  if (template.split(INPUT_PLACEHOLDER).length !== 2) {
    throw new Error(
      `Prompt template must contain exactly one ${INPUT_PLACEHOLDER} placeholder`,
    );
  }
  return template.replace(INPUT_PLACEHOLDER, () => data);
}

export function renderPrompt(
  id: string,
  input: unknown,
): { id: string; text: string } {
  return {
    id,
    text: fillInputPlaceholder(loadPrompt(id), JSON.stringify(input)),
  };
}
