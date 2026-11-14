import type {
  MistakeView,
  Session,
  SessionDetails,
  TurnResult,
  Utterance,
} from '@gototalk/shared';

function ordered(utterances: Utterance[]): Utterance[] {
  return [...utterances].sort((a, b) => a.seq - b.seq);
}

function hasUtterance(utterances: Utterance[], id: string): boolean {
  return utterances.some((item) => item.id === id);
}

/** Ignores a second copy of an utterance id that is already stored. */
export function withUtterance(
  details: SessionDetails,
  utterance: Utterance,
): SessionDetails {
  const { utterances } = details;
  return {
    ...details,
    utterances: ordered(
      hasUtterance(utterances, utterance.id)
        ? utterances
        : [...utterances, utterance],
    ),
  };
}

export function withTurnResult(
  details: SessionDetails,
  { utterance, reply, planRemaining }: TurnResult,
): SessionDetails {
  const answered = hasUtterance(details.utterances, utterance.id)
    ? details.utterances.map((item) =>
        item.id === utterance.id ? utterance : item,
      )
    : [...details.utterances, utterance];
  const withReply =
    reply === null || hasUtterance(answered, reply.id)
      ? answered
      : [...answered, reply];
  return { ...details, utterances: ordered(withReply), planRemaining };
}

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

export function withSession(
  details: SessionDetails,
  session: Session,
): SessionDetails {
  return { ...details, ...session };
}

/** The last user utterance of an active session, when its analysis or the reply to it is still missing. */
export function findUnansweredUtteranceId(
  details: SessionDetails,
): string | undefined {
  if (details.status !== 'active') {
    return undefined;
  }
  const lastUser = details.utterances.findLast((item) => item.role === 'user');
  if (lastUser === undefined) {
    return undefined;
  }
  const isLast = details.utterances.at(-1)?.id === lastUser.id;
  return isLast || lastUser.analysisStatus === 'pending'
    ? lastUser.id
    : undefined;
}
