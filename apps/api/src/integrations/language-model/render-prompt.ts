import { loadPrompt } from './prompt-loader.js';

const INPUT_PLACEHOLDER = '{{input}}';
const BACKTICK = /`/g;

// A backtick in the data could close the fenced data block, so it is written as a JSON escape
function serializeInput(input: unknown): string {
  return JSON.stringify(input).replace(BACKTICK, '\x5Cu0060');
}

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
    text: fillInputPlaceholder(loadPrompt(id), serializeInput(input)),
  };
}
