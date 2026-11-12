import { relations } from 'drizzle-orm/relations';
import {
  users,
  goals,
  sessions,
  mistakePatterns,
  theoryLinks,
  mistakeCategories,
  hints,
  utterances,
  words,
  sessionReports,
  cards,
  exercises,
  refreshTokens,
  mistakes,
  profiles,
} from './schema.js';

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  goals: many(goals),
  sessions: many(sessions),
  mistakePatterns: many(mistakePatterns),
  refreshTokens: many(refreshTokens),
  profiles: many(profiles),
  words: many(words),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  hints: many(hints),
  sessionReports: many(sessionReports),
  utterances: many(utterances),
}));

export const mistakePatternsRelations = relations(
  mistakePatterns,
  ({ one, many }) => ({
    user: one(users, {
      fields: [mistakePatterns.userId],
      references: [users.id],
    }),
    theoryLink: one(theoryLinks, {
      fields: [mistakePatterns.theoryLinkId],
      references: [theoryLinks.id],
    }),
    mistakeCategory: one(mistakeCategories, {
      fields: [mistakePatterns.category],
      references: [mistakeCategories.code],
    }),
    mistakes: many(mistakes),
  }),
);

export const theoryLinksRelations = relations(theoryLinks, ({ one, many }) => ({
  mistakePatterns: many(mistakePatterns),
  mistakeCategory: one(mistakeCategories, {
    fields: [theoryLinks.category],
    references: [mistakeCategories.code],
  }),
}));

export const mistakeCategoriesRelations = relations(
  mistakeCategories,
  ({ many }) => ({
    mistakePatterns: many(mistakePatterns),
    theoryLinks: many(theoryLinks),
    mistakes: many(mistakes),
  }),
);

export const hintsRelations = relations(hints, ({ one }) => ({
  session: one(sessions, {
    fields: [hints.sessionId],
    references: [sessions.id],
  }),
  utterance: one(utterances, {
    fields: [hints.utteranceId],
    references: [utterances.id],
  }),
  word: one(words, {
    fields: [hints.wordId],
    references: [words.id],
  }),
}));

export const utterancesRelations = relations(utterances, ({ one, many }) => ({
  hints: many(hints),
  mistakes: many(mistakes),
  session: one(sessions, {
    fields: [utterances.sessionId],
    references: [sessions.id],
  }),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
  hints: many(hints),
  cards: many(cards),
  user: one(users, {
    fields: [words.userId],
    references: [users.id],
  }),
}));

export const sessionReportsRelations = relations(sessionReports, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionReports.sessionId],
    references: [sessions.id],
  }),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  word: one(words, {
    fields: [cards.wordId],
    references: [words.id],
  }),
  exercises: many(exercises),
}));

export const exercisesRelations = relations(exercises, ({ one }) => ({
  card: one(cards, {
    fields: [exercises.cardId],
    references: [cards.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const mistakesRelations = relations(mistakes, ({ one }) => ({
  utterance: one(utterances, {
    fields: [mistakes.utteranceId],
    references: [utterances.id],
  }),
  mistakePattern: one(mistakePatterns, {
    fields: [mistakes.patternId],
    references: [mistakePatterns.id],
  }),
  mistakeCategory: one(mistakeCategories, {
    fields: [mistakes.category],
    references: [mistakeCategories.code],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));
