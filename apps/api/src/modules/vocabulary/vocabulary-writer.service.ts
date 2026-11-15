import { Injectable } from '@nestjs/common';
import type { BetterPhrasing } from '@gototalk/shared';
import type { DbTransaction } from '../../core/db/db.tokens.js';
import { sessionWordCandidates } from './lib/session-word-candidates.js';
import { SessionWordsRepository } from './persistence/session-words.repository.js';
import { WordsRepository } from './persistence/words.repository.js';

@Injectable()
export class VocabularyWriter {
  constructor(
    private readonly words: WordsRepository,
    private readonly sessionWords: SessionWordsRepository,
  ) {}

  async addFromHint(
    tx: DbTransaction,
    {
      userId,
      sessionId,
      word,
    }: {
      userId: string;
      sessionId: string;
      word: { lemma: string; translationUk: string };
    },
  ): Promise<string> {
    const wordId = await this.words.addFromHint(tx, userId, word);
    await this.sessionWords.link(tx, userId, sessionId, [wordId]);
    return wordId;
  }

  async saveSessionWords(
    tx: DbTransaction,
    {
      userId,
      sessionId,
      better,
    }: { userId: string; sessionId: string; better: BetterPhrasing[] },
  ): Promise<void> {
    const candidates = sessionWordCandidates(better);
    const wordIds = await this.words.addFromSession(tx, userId, candidates);
    await this.sessionWords.link(tx, userId, sessionId, wordIds);
  }
}
