import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

describe('DB schema after migrations', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: inject('testDatabaseUrl') });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('session_words and report metadata (0005)', () => {
    it('[TC-00-01] session_words has a composite primary key and cascading foreign keys', async () => {
      const { rows } = await pool.query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = 'public.session_words'::regclass AND contype IN ('p', 'f')
         ORDER BY contype DESC, pg_get_constraintdef(oid) COLLATE "C"`,
      );

      expect(rows.map((row) => row.definition)).toEqual([
        'PRIMARY KEY (session_id, word_id)',
        'FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE',
        'FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE',
      ]);
    });

    it('[TC-00-01] the new indexes cover the keyset order and the word foreign key', async () => {
      const { rows } = await pool.query<{
        indexname: string;
        indexdef: string;
      }>(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname IN ('idx_session_words_word', 'idx_words_user_created')
         ORDER BY indexname COLLATE "C"`,
      );

      expect(rows.map((row) => row.indexname)).toEqual([
        'idx_session_words_word',
        'idx_words_user_created',
      ]);
      expect(rows[0]?.indexdef).toContain('(word_id)');
      expect(rows[1]?.indexdef).toContain(
        '(user_id, created_at DESC, id DESC)',
      );
    });

    it('[TC-00-01] session_reports has nullable prompt_version and model columns', async () => {
      const { rows } = await pool.query<{
        column_name: string;
        is_nullable: string;
        data_type: string;
      }>(
        `SELECT column_name, is_nullable, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'session_reports'
           AND column_name IN ('prompt_version', 'model')
         ORDER BY column_name COLLATE "C"`,
      );

      expect(rows).toEqual([
        { column_name: 'model', is_nullable: 'YES', data_type: 'text' },
        {
          column_name: 'prompt_version',
          is_nullable: 'YES',
          data_type: 'text',
        },
      ]);
    });

    describe('with a user, session and word', () => {
      let userId: string;
      let sessionId: string;
      let wordId: string;

      beforeAll(async () => {
        const user = await pool.query<{ id: string }>(
          `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
          [`${randomUUID()}@example.com`],
        );
        userId = user.rows[0]?.id ?? '';
        const session = await pool.query<{ id: string }>(
          `INSERT INTO sessions (user_id, topic, status) VALUES ($1, 'topic', 'finished') RETURNING id`,
          [userId],
        );
        sessionId = session.rows[0]?.id ?? '';
        const word = await pool.query<{ id: string }>(
          `INSERT INTO words (user_id, lemma) VALUES ($1, $2) RETURNING id`,
          [userId, `lemma-${randomUUID()}`],
        );
        wordId = word.rows[0]?.id ?? '';
      });

      afterAll(async () => {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      });

      const link = (session: string, word: string) =>
        pool.query(
          'INSERT INTO session_words (session_id, word_id) VALUES ($1, $2)',
          [session, word],
        );

      const countLinks = async (session: string) =>
        Number(
          (
            await pool.query<{ count: string }>(
              'SELECT count(*) FROM session_words WHERE session_id = $1',
              [session],
            )
          ).rows[0]?.count,
        );

      it('[TC-00-01] linking the same word to a session twice is rejected', async () => {
        await link(sessionId, wordId);

        await expect(link(sessionId, wordId)).rejects.toMatchObject({
          code: '23505',
          constraint: 'session_words_pkey',
        });
        expect(await countLinks(sessionId)).toBe(1);
      });

      it('[TC-00-01] a link to a missing session or word is rejected', async () => {
        await expect(link(randomUUID(), wordId)).rejects.toMatchObject({
          code: '23503',
        });
        await expect(link(sessionId, randomUUID())).rejects.toMatchObject({
          code: '23503',
        });
      });

      it('[TC-00-01] deleting the word removes its links but keeps the session', async () => {
        const other = await pool.query<{ id: string }>(
          `INSERT INTO words (user_id, lemma) VALUES ($1, $2) RETURNING id`,
          [userId, `lemma-${randomUUID()}`],
        );
        const otherWordId = other.rows[0]?.id ?? '';
        await link(sessionId, otherWordId);
        const before = await countLinks(sessionId);

        await pool.query('DELETE FROM words WHERE id = $1', [otherWordId]);

        expect(await countLinks(sessionId)).toBe(before - 1);
        const { rowCount } = await pool.query(
          'SELECT 1 FROM sessions WHERE id = $1',
          [sessionId],
        );
        expect(rowCount).toBe(1);
      });

      it('[TC-00-01] deleting the session removes its links but keeps the word', async () => {
        const session = await pool.query<{ id: string }>(
          `INSERT INTO sessions (user_id, topic, status) VALUES ($1, 'topic', 'finished') RETURNING id`,
          [userId],
        );
        const otherSessionId = session.rows[0]?.id ?? '';
        await link(otherSessionId, wordId);

        await pool.query('DELETE FROM sessions WHERE id = $1', [
          otherSessionId,
        ]);

        expect(await countLinks(otherSessionId)).toBe(0);
        const word = await pool.query('SELECT 1 FROM words WHERE id = $1', [
          wordId,
        ]);
        expect(word.rowCount).toBe(1);
      });
    });
  });
});
