import {
  FeedbackModeSchema,
  SessionStatusSchema,
  TopicSourceSchema,
} from '@gototalk/shared';
import type { Session } from '@gototalk/shared';
import { pgTimestampToDate } from '../../../core/db/pg-timestamp.js';
import type { sessions } from '../../../core/db/schema.js';

type SessionRow = typeof sessions.$inferSelect;

function toIso(value: string): string {
  return pgTimestampToDate(value).toISOString();
}

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    topic: row.topic,
    topicSource: TopicSourceSchema.parse(row.topicSource),
    feedbackMode: FeedbackModeSchema.parse(row.feedbackMode),
    status: SessionStatusSchema.parse(row.status),
    startedAt: toIso(row.startedAt),
    endedAt: row.endedAt === null ? null : toIso(row.endedAt),
  };
}
