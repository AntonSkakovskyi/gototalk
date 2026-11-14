import type { DbTransaction } from '../../../core/db/db.tokens.js';
import { lockSession } from '../../session/persistence/lock-session.js';
import {
  SessionFinishedError,
  SessionNotFoundError,
} from '../dialogue.errors.js';

/** Locks the session row until the transaction ends; throws when the session is missing or no longer active. */
export async function lockActiveSession(
  tx: DbTransaction,
  userId: string,
  sessionId: string,
): Promise<void> {
  const status = await lockSession(tx, userId, sessionId);
  if (status === null) throw new SessionNotFoundError();
  if (status !== 'active') throw new SessionFinishedError();
}
