import { and, eq } from 'drizzle-orm';
import type { DbTransaction } from '../../core/db/db.tokens.js';
import { sessions } from '../../core/db/schema.js';
import {
  SessionFinishedError,
  SessionNotFoundError,
} from './session.errors.js';

/** Locks the session row of the user until the transaction ends; returns its status, or null when there is no such session. */
export async function lockSession(
  tx: DbTransaction,
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const [session] = await tx
    .select({ status: sessions.status })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .for('update');
  return session?.status ?? null;
}

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
