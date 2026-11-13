import type pg from 'pg';

export async function insertFinished(
  pool: pg.Pool,
  userId: string,
  topic: string,
  startedAt: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO sessions (user_id, topic, status, started_at, ended_at, plan)
     VALUES ($1, $2, 'finished', $3, $3::timestamptz + interval '5 minutes', $4)
     RETURNING id`,
    [userId, topic, startedAt, JSON.stringify({ questions: ['q'] })],
  );
  const row = rows[0];
  if (!row) throw new Error('Session insert returned no row');
  return row.id;
}

export async function insertUtterance(
  pool: pg.Pool,
  sessionId: string,
  seq: number,
  role: 'assistant' | 'user',
  text: string,
  analysisStatus = 'skipped',
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO utterances (session_id, seq, role, text_verbatim, analysis_status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [sessionId, seq, role, text, analysisStatus],
  );
  const row = rows[0];
  if (!row) throw new Error('Utterance insert returned no row');
  return row.id;
}

export async function setPlan(
  pool: pg.Pool,
  sessionId: string,
  plan: unknown,
): Promise<void> {
  await pool.query('UPDATE sessions SET plan = $2 WHERE id = $1', [
    sessionId,
    plan === null ? null : JSON.stringify(plan),
  ]);
}
