import { isScenePreset, PLAN_QUESTIONS } from '@gototalk/shared';
import type { MistakeCategoryCode, Plan, ScenePreset } from '@gototalk/shared';
import type { PlanSessionInput } from './language-model.port.js';

const FALLBACK_SCENE: ScenePreset = 'small_talk';

const TOPICS_PER_SCENE = 5;

const TOPIC_BANK: Record<ScenePreset, readonly string[]> = {
  work_meetings: [
    'My last project at work',
    'A difficult meeting',
    'Planning a week',
    'Working with a team',
    'A skill I want to learn',
  ],
  small_talk: [
    'Weekend plans',
    'My hometown',
    'Favourite food',
    'A film I watched',
    'Weather and seasons',
  ],
  interviews: [
    'Why I want this job',
    'My strengths',
    'A challenge I solved',
    'My career goals',
    'Questions for the interviewer',
  ],
  daily_services: [
    'At the doctor',
    'Renting a flat',
    'Ordering food',
    'A problem with an order',
    'Using public transport',
  ],
  travel: [
    'My last trip',
    'Booking a hotel',
    'A dream destination',
    'Getting lost in a city',
    'Travel plans',
  ],
};

const UNIVERSAL_QUESTIONS: readonly ((topic: string) => string)[] = [
  (topic) => `What is your main goal when you talk about "${topic}"?`,
  (topic) => `Tell me about your own experience with "${topic}".`,
  (topic) => `What do you think is the most important part of "${topic}"?`,
  (topic) => `How is "${topic}" different from what you did before?`,
  () => 'What would you do differently next time?',
];

const CUSTOM_TOPIC_QUESTIONS: readonly ((topic: string) => string)[] = [
  (topic) =>
    `What is the first thing that comes to mind when you think about "${topic}"?`,
  (topic) => `Why did you choose to talk about "${topic}"?`,
  (topic) => `Tell me about your experience with "${topic}".`,
  (topic) => `What do you find most difficult about "${topic}"?`,
  (topic) => `How do you see "${topic}" in the future?`,
];

const PATTERN_QUESTIONS: Partial<Record<MistakeCategoryCode, string>> = {
  verb_tense: 'Tell me what you did yesterday at work.',
  articles: 'Describe your office or your room in detail.',
  prepositions: 'When and where do you usually meet your friends?',
  subject_verb_agreement: 'What does your best friend do every day?',
  question_form: 'Ask me three questions about my job.',
};

const DEFAULT_PATTERN_QUESTION = 'Tell me about a typical day in your life.';

function pickTopic({ scenes, previousTopics }: PlanSessionInput): string {
  const scene = scenes.find(isScenePreset) ?? FALLBACK_SCENE;
  const topics = TOPIC_BANK[scene];
  return topics[previousTopics.length % TOPICS_PER_SCENE] ?? topics[0] ?? '';
}

export function buildFakePlan(input: PlanSessionInput): Plan {
  const customTopic = input.customTopic?.trim();
  const topic = customTopic ? customTopic : pickTopic(input);
  const templates = customTopic ? CUSTOM_TOPIC_QUESTIONS : UNIVERSAL_QUESTIONS;
  const questions = templates
    .slice(0, PLAN_QUESTIONS)
    .map((template) => template(topic));

  const [mostFrequent] = input.patterns;
  if (mostFrequent !== undefined) {
    questions[0] = PATTERN_QUESTIONS[mostFrequent] ?? DEFAULT_PATTERN_QUESTION;
  }
  return { topic, questions };
}
