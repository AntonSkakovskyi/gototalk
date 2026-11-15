import 'reflect-metadata';
import type { DbTransaction } from '../../core/db/db.tokens.js';
import { describe, expect, it, vi } from 'vitest';
import type { SessionWordsRepository } from './persistence/session-words.repository.js';
import type { WordsRepository } from './persistence/words.repository.js';
import { VocabularyWriter } from './vocabulary-writer.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const tx = {} as DbTransaction;

function setup() {
  const addFromHint = vi.fn().mockResolvedValue('word-1');
  const addFromSession = vi.fn().mockResolvedValue(['word-2', 'word-3']);
  const link = vi.fn().mockResolvedValue(undefined);
  const writer = new VocabularyWriter(
    { addFromHint, addFromSession } as unknown as WordsRepository,
    { link } as unknown as SessionWordsRepository,
  );
  return { writer, addFromHint, addFromSession, link };
}

describe('VocabularyWriter.addFromHint', () => {
  it('adds the hinted word, links it to the session and returns its id', async () => {
    const { writer, addFromHint, link } = setup();
    const word = { lemma: 'harvest', translationUk: 'урожай' };

    const wordId = await writer.addFromHint(tx, {
      userId: USER_ID,
      sessionId: SESSION_ID,
      word,
    });

    expect(wordId).toBe('word-1');
    expect(addFromHint).toHaveBeenCalledWith(tx, USER_ID, word);
    expect(link).toHaveBeenCalledWith(tx, USER_ID, SESSION_ID, ['word-1']);
  });
});

describe('VocabularyWriter.saveSessionWords', () => {
  it('adds the new tokens of the better phrasings and links them to the session', async () => {
    const { writer, addFromSession, link } = setup();

    await writer.saveSessionWords(tx, {
      userId: USER_ID,
      sessionId: SESSION_ID,
      better: [{ original: 'yesterday I go', better: 'yesterday I went' }],
    });

    expect(addFromSession).toHaveBeenCalledWith(tx, USER_ID, ['went']);
    expect(link).toHaveBeenCalledWith(tx, USER_ID, SESSION_ID, [
      'word-2',
      'word-3',
    ]);
  });

  it('links nothing extra when no candidate tokens are found', async () => {
    const { writer, addFromSession, link } = setup();
    addFromSession.mockResolvedValue([]);

    await writer.saveSessionWords(tx, {
      userId: USER_ID,
      sessionId: SESSION_ID,
      better: [],
    });

    expect(addFromSession).toHaveBeenCalledWith(tx, USER_ID, []);
    expect(link).toHaveBeenCalledWith(tx, USER_ID, SESSION_ID, []);
  });
});
