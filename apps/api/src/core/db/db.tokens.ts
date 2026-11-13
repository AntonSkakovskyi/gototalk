import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as relations from './relations.js';
import * as tables from './schema.js';

export const dbSchema = { ...tables, ...relations };

export type Database = NodePgDatabase<typeof dbSchema>;

export type DbTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export type DbExecutor = Database | DbTransaction;

export const PG_POOL = Symbol('PG_POOL');

export const DRIZZLE = Symbol('DRIZZLE');
