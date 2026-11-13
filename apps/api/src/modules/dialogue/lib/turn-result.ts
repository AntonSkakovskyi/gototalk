import type { SessionDetails, TurnResult } from '@gototalk/shared';

export function toTurnResult(
  details: SessionDetails,
  utteranceId: string,
): TurnResult | null {
  const utterance = details.utterances.find(({ id }) => id === utteranceId);
  if (!utterance) return null;
  const reply =
    details.utterances.find(
      ({ seq, role }) => seq === utterance.seq + 1 && role === 'assistant',
    ) ?? null;
  return { utterance, reply, planRemaining: details.planRemaining };
}
