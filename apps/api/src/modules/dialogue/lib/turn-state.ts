import type { AnalysisStatus } from '@gototalk/shared';
import type { NextTurnInput } from '../../../integrations/language-model/language-model.port.js';
import { buildNextTurnInput } from './build-next-turn-input.js';

export interface StoredUtterance {
  id: string;
  seq: number;
  role: 'assistant' | 'user';
  textVerbatim: string;
  textClean: string | null;
  analysisStatus: AnalysisStatus;
}

export interface TurnState {
  sessionActive: boolean;
  topic: string;
  planQuestions: string[];
  /** Ordered by seq. */
  utterances: StoredUtterance[];
  target: StoredUtterance;
}

export interface TurnNeeds {
  analysis: boolean;
  reply: boolean;
}

export function turnNeeds({
  sessionActive,
  utterances,
  target,
}: TurnState): TurnNeeds {
  const replyTaken = utterances.some(({ seq }) => seq === target.seq + 1);
  return {
    analysis: target.analysisStatus === 'pending',
    reply: sessionActive && !replyTaken,
  };
}

export function nextTurnInputOf(state: TurnState): NextTurnInput {
  return buildNextTurnInput({
    topic: state.topic,
    planQuestions: state.planQuestions,
    utterances: state.utterances.map((utterance) => ({
      seq: utterance.seq,
      role: utterance.role,
      text:
        utterance.role === 'user'
          ? (utterance.textClean ?? utterance.textVerbatim)
          : utterance.textVerbatim,
    })),
  });
}
