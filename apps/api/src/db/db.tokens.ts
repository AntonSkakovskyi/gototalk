import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as relations from './relations.js';
import * as tables from './schema.js';

/** Схема для drizzle: таблиці та relations, згенеровані `pnpm db:pull`. */
export const dbSchema = { ...tables, ...relations };

export type Database = NodePgDatabase<typeof dbSchema>;

/** DI-токен пулу `pg.Pool`. */
export const PG_POOL = Symbol('PG_POOL');

/** DI-токен екземпляра Drizzle (`Database`). */
export const DRIZZLE = Symbol('DRIZZLE');
