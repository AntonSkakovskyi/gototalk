import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit сам .env не читає; єдиний .env лежить у корені репозиторію.
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Міграції пишуться вручну в SQL (drizzle-kit generate --custom), TS-схема не є джерелом правди.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts', // з'являється після db:pull (задача 00-05)
  out: '../../db/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
