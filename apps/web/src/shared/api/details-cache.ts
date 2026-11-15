import type { MistakeView, SessionDetails } from '@gototalk/shared';

export function withMistake(
  details: SessionDetails,
  mistake: MistakeView,
): SessionDetails {
  let found = false;
  const utterances = details.utterances.map((utterance) => {
    if (!utterance.mistakes.some((item) => item.id === mistake.id)) {
      return utterance;
    }
    found = true;
    return {
      ...utterance,
      mistakes: utterance.mistakes.map((item) =>
        item.id === mistake.id ? mistake : item,
      ),
    };
  });
  return found ? { ...details, utterances } : details;
}
