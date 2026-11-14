import { and, eq } from 'drizzle-orm';
import type { DbTransaction } from '../../../core/db/db.tokens.js';
import { sessions } from '../../../core/db/schema.js';

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
